// Audit the confirmed result, using the signed-in actor rather than client names.
export function auditMutations(client) {
  return (req, res, next) => {
    const kind = /^\/(users|categories|qr-locations|lost-items|found-items)(?:\/|$)/.exec(req.path)?.[1];
    if (!kind || req.path.endsWith('/claim') || !['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
    const send = res.json.bind(res);
    res.json = body => {
      res.json = send;
      if (res.statusCode >= 400) return send(body);
      const report = ['lost-items','found-items'].includes(kind);
      const action = req.method === 'DELETE' ? 'delete' : req.method === 'POST' ? (report ? 'report' : 'create') : report && req.body.status === 'cancelled' ? 'cancel' : report && req.body.status === 'active' ? 'approve' : 'update';
      const reference = body?.id || req.path.split('/')[2] || 'settings';
      const details = `${kind === 'qr-locations' ? 'Location' : kind === 'users' ? 'Account' : kind === 'lost-items' ? 'Lost report' : kind === 'found-items' ? 'Found report' : 'Category'} #${reference} ${['create','report'].includes(action) ? 'created' : action === 'delete' ? 'deleted' : action === 'cancel' ? 'cancelled' : action === 'approve' ? 'approved' : 'updated'}${req.path.endsWith('/role') ? ` (role: ${body?.role || req.body?.role})` : req.path.endsWith('/status') ? ` (status: ${body?.status || req.body?.status})` : ''}${report && req.body.cancel_reason ? ' Reason: ' + req.body.cancel_reason.trim() : ''}.`;
      Promise.resolve(client.from('activity_logs').insert({
        action, details, user_name: req.actor?.name || 'Administrator',
        role: req.actor?.role || 'admin', timestamp: new Date().toISOString(),
      })).then(result => {
        if (result.error) throw result.error;
      }).catch(() => res.set('X-Activity-Warning', 'Change saved, but its activity log could not be recorded. Contact the administrator.'))
        .finally(() => send(body));
      return res;
    };
    next();
  };
}
