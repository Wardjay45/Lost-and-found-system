import { readFileSync } from 'node:fs';

export async function installReportCancellation(fixture) {
  const migration = new URL('../../../supabase/migrations/20261109131320_report_cancellation_actor.sql', import.meta.url);
  await fixture.db.exec(readFileSync(migration, 'utf8'));
  fixture.writer.rpc = async (name, { p_table, p_report_id, p_actor_id, p_reason, p_owner_only }) => {
    if (name !== 'cancel_item_report') throw new Error('Unexpected report RPC');
    try {
      const data = await fixture.db.transaction(async tx => {
        await tx.exec('SET LOCAL ROLE service_role');
        const { rows } = await tx.query('SELECT public.cancel_item_report($1, $2, $3, $4, $5) AS report',
          [p_table, p_report_id, p_actor_id, p_reason, p_owner_only]);
        return rows[0].report;
      });
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  };
}
