import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import express from 'express';
import jwt from 'jsonwebtoken';
import { createCategoriesRouter } from '../../routes/categories.js';

// Exercise the actual RLS and foreign-key constraints using isolated PostgreSQL,
// with a small PostgREST-compatible adapter for the route's database queries.
export async function categoryFixture() {
  const db = new PGlite();
  const schema = readFileSync(new URL('../../../supabase-schema.sql', import.meta.url), 'utf8');
  await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;');
  for (const table of ['categories', 'users', 'lost_items', 'found_items', 'matches', 'messages', 'conversations', 'activity_logs', 'qr_locations']) {
    const columns = schema.split('CREATE TABLE IF NOT EXISTS ' + table + ' (')[1].split(');')[0];
    await db.exec(`CREATE TABLE ${table} (${columns});`);
  }
  await db.exec(`GRANT USAGE ON SCHEMA public TO anon, service_role;
    GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, service_role;
    GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, service_role;
    ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
    CREATE POLICY category_reads ON categories FOR SELECT USING (true);
    INSERT INTO users(id,name,email,password,role,status) VALUES (7,'Admin','category-test@example.invalid','isolated','admin','active');`);
  const fault = { table: null, action: null };
  const identifier = value => {
    assert.match(value, /^[a-z_]+$/);
    return '"' + value + '"';
  };
  function client(role) {
    return { from(table) {
      assert.ok(['categories', 'users', 'lost_items', 'found_items', 'matches', 'messages', 'conversations', 'activity_logs', 'qr_locations'].includes(table));
      let action = 'select', fields, columns = '*', orders = [], single = false, pageLimit, pageOffset = 0;
      const filters = [];
      const q = {
        select(value = '*') { columns = value; return q; },
        insert(value) { action = 'insert'; fields = value; return q; },
        update(value) { action = 'update'; fields = value; return q; },
        delete() { action = 'delete'; return q; },
        eq(key, value) { filters.push([key, '=', value]); return q; },
        is(key, value) { assert.equal(value, null); filters.push([key, 'IS NULL']); return q; },
        in(key, values) { filters.push([key, 'IN', values]); return q; },
        order(key, options = {}) { orders.push(identifier(key) + (options.ascending === false ? ' DESC' : ' ASC')); return q; },
        limit(count) { pageLimit = count; return q; },
        range(first, last) { pageOffset = first; pageLimit = last - first + 1; return q; },
        or(value) { filters.push([null, 'OR', value]); return q; },
        not(key, operator, value) { assert.equal(operator, 'in'); filters.push([key, 'NOT IN', value.slice(1,-1).split(',')]); return q; },
        single() { single = true; return q; },
        maybeSingle() { single = true; return q; },
        then(resolve, reject) {
          const run = async () => {
            if (fault.table === table && fault.action === action) return { data: null, error: { code: 'TEST', message: 'isolated database failure' } };
            const params = [];
            const bind = value => { params.push(value); return '$' + params.length; };
            const selected = columns === '*' ? '*' : columns.split(',').map(identifier).join(',');
            let sql;
            if (action === 'insert') sql = `INSERT INTO ${identifier(table)} (${Object.keys(fields).map(identifier)}) VALUES (${Object.values(fields).map(bind)})`;
            else if (action === 'update') sql = `UPDATE ${identifier(table)} SET ${Object.entries(fields).map(([key, value]) => identifier(key) + '=' + bind(value)).join(',')}`;
            else if (action === 'delete') sql = 'DELETE FROM ' + identifier(table);
            else sql = `SELECT ${selected} FROM ${identifier(table)}`;
            if (filters.length) sql += ' WHERE ' + filters.map(([key, op, value]) => {
              if (op === 'OR') {
                let depth = 0, part = '', pieces = [];
                for (const character of value + ',') {
                  if (character === ',' && depth === 0) { pieces.push(part); part = ''; continue; }
                  if (character === '(') depth++;
                  if (character === ')') depth--;
                  part += character;
                }
                return '(' + pieces.map(piece => {
                  const match = /^([a-z_]+)\.(eq|in)\.(.*)$/.exec(piece);
                  assert.ok(match, piece);
                  return identifier(match[1]) + (match[2] === 'eq' ? '=' + bind(match[3]) : ' IN (' + match[3].slice(1,-1).split(',').map(bind).join(',') + ')');
                }).join(' OR ') + ')';
              }
              if (op === 'IS NULL') return identifier(key) + ' IS NULL';
              if (op === 'IN' || op === 'NOT IN') return value.length ? identifier(key) + ' ' + op + ' (' + value.map(bind).join(',') + ')' : 'FALSE';
              return identifier(key) + '=' + bind(value);
            }).join(' AND ');
            if (action !== 'select') sql += ' RETURNING ' + selected;
            else if (orders.length) sql += ' ORDER BY ' + orders.join(',');
            if (action === 'select' && pageLimit !== undefined) sql += ' LIMIT ' + Number(pageLimit) + ' OFFSET ' + Number(pageOffset);
            try {
              const rows = await db.transaction(async tx => {
                await tx.exec('SET LOCAL ROLE ' + role);
                const result = await tx.query(sql, params);
                // PostgREST sends TIMESTAMP WITHOUT TIME ZONE as a string.
                // PGlite's Date parser uses the host timezone, so reconstruct
                // the stored wall-clock fields before emulating that contract.
                for (const field of result.fields || []) {
                  if (Number(field.dataTypeID) !== 1114) continue;
                  for (const row of result.rows) {
                    const value = row[field.name];
                    if (value instanceof Date) row[field.name] = new Date(Date.UTC(value.getFullYear(),value.getMonth(),value.getDate(),value.getHours(),value.getMinutes(),value.getSeconds(),value.getMilliseconds())).toISOString().slice(0,-1);
                  }
                }
                return result.rows;
              });
              return { data: single ? rows[0] || null : rows, error: null };
            } catch (error) { return { data: null, error }; }
          };
          return run().then(resolve, reject);
        },
      };
      return q;
    } };
  }
  let storageCalls = 0;
  const reader = client('anon'), writer = client('service_role');
  const secret = 'isolated-category-test-session';
  const app = express();
  app.use(express.json());
  app.use('/api/categories', createCategoriesRouter({ client: reader, storage: () => { storageCalls++; return writer; }, jwtSecret: secret }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const token = jwt.sign({ id: 7, role: 'admin' }, secret);
  const origin = 'http://127.0.0.1:' + server.address().port;
  const call = (method, path = '', body, session = token) => fetch(origin + '/api/categories' + path, {
    method, headers: { 'Content-Type': 'application/json', ...(session ? { Authorization: 'Bearer ' + session } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  return { db, fault, reader, writer, app, origin, call, token, get storageCalls() { return storageCalls; },
    close: async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); await db.close(); } };
}
