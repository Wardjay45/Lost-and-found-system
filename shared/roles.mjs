// Keep older admin sessions compatible while presenting one admin role.
export const isAdminRole = role => role === 'admin' || role === 'superadmin';

export const accountRoleLabel = role => isAdminRole(role) ? 'Admin' : role === 'student' ? 'Campus user' : role || 'Account';
