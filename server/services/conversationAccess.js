const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };

export function createConversationAccess(client) {
  let hasOwnerColumn;
  const check = result => { if (result.error) throw result.error; return result.data; };
  async function ownerColumn() {
    if (hasOwnerColumn === undefined) {
      const result = await client.from('conversations').select('id,user_id').limit(1);
      if (result.error && !['42703','PGRST204'].includes(result.error.code)) throw result.error;
      hasOwnerColumn = !result.error;
    }
    return hasOwnerColumn;
  }
  async function forUser(user, create = false) {
    if (!user?.id || !user.name) fail(400, 'Choose a reporter account.');
    if (await ownerColumn()) {
      const owned = check(await client.from('conversations').select('*').eq('user_id', user.id).maybeSingle());
      if (owned) return owned;
    }
    // Safe compatibility until the owner-column migration is applied: never
    // attach a shared display name or an ambiguous legacy conversation.
    const names = check(await client.from('users').select('id').eq('name', user.name).limit(2));
    if (names.length !== 1 || Number(names[0].id) !== Number(user.id)) {
      if (hasOwnerColumn) return create ? createOwned(user) : null;
      fail(409, 'This conversation needs an administrator to confirm its account owner.');
    }
    let legacyQuery = client.from('conversations').select('*').eq('name', user.name);
    if (hasOwnerColumn) legacyQuery = legacyQuery.is('user_id', null);
    const legacy = check(await legacyQuery.order('id').limit(2));
    if (legacy.length > 1) {
      if (hasOwnerColumn) return create ? createOwned(user) : null;
      fail(409, 'This account has multiple legacy conversations. Contact the administrator.');
    }
    if (legacy[0]) {
      if (!hasOwnerColumn) return legacy[0];
      const attached = await client.from('conversations').update({ user_id: user.id }).eq('id', legacy[0].id).is('user_id', null).select().maybeSingle();
      if (attached.error) throw attached.error;
      if (!attached.data) return forUser(user, create);
      return attached.data;
    }
    if (!create) return null;
    return createOwned(user);
  }
  async function createOwned(user) {
    const saved = await client.from('conversations').insert({ name: user.name, avatar: user.name.charAt(0).toUpperCase(), ...(hasOwnerColumn ? { user_id: user.id } : {}) }).select().single();
    if (saved.error?.code === '23505' && hasOwnerColumn) return forUser(user, false);
    return check(saved);
  }
  async function recipient(id) {
    if (!Number.isSafeInteger(Number(id)) || Number(id) <= 0) fail(400, 'Choose a valid recipient account.');
    const user = check(await client.from('users').select('id,name,status').eq('id', Number(id)).maybeSingle());
    if (!user) fail(404, 'Recipient account not found.');
    return user;
  }
  return { forUser, recipient, ownerColumn };
}
