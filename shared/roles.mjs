// Keep older admin sessions compatible while presenting one admin role.
export const isAdminRole = role => role === 'admin' || role === 'superadmin';

export function cancellationActorLabel(role) {
  if (isAdminRole(role)) return 'Cancelled by Admin';
  if (role === 'student') return 'Cancelled by User';
  return 'Cancelled by unknown';
}

export const accountRoleLabel = role => isAdminRole(role) ? 'Admin' : role === 'student' ? 'Campus user' : role || 'Account';
