import { useAuth } from '../context/AuthContext';
import { useRef } from 'react';
import { PageHeader, DataRegion } from '../components/common/UI';
import { useState, useMemo, useEffect } from 'react';
import { usersApi } from '../services/api';
import useLiveRefresh from '../hooks/useLiveRefresh';
import StatusBadge from '../components/common/StatusBadge';
import Modal from '../components/common/Modal';
import { formatDate, formatDateTime } from '../utils/formatters';
import { accountRoleLabel, isAdminRole } from '../../../shared/roles.mjs';

export default function Users() {
  const { user: actor } = useAuth();
  const [actionError, setActionError] = useState('');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const actionLock = useRef(false);
  const canManage = target => actor && isAdminRole(actor.role) && String(target.id) !== String(actor.id) && target.role === 'student';
  const [pageError, setPageError] = useState('');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = ({ background = false } = {}) => {
    if (!background) setLoading(true);
    return usersApi.getAll().then(data => {
      setUsers(data); setPageError('');
      setSelectedUser(current => current ? data.find(user => String(user.id) === String(current.id)) || null : null);
    }).catch(err => setPageError(err.message || 'Unable to load this section.')).finally(() => setLoading(false));
  };
  useLiveRefresh('users', loadUsers);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedUser, setSelectedUser] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);

  const filtered = useMemo(() => {
    return users.filter(u => {
      if (statusFilter !== 'all' && u.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || (u.student_id || u.studentId || '').toLowerCase().includes(q);
      }
      return true;
    });
  }, [users, search, statusFilter]);

  const handleStatusChange = async (userId, newStatus) => {
    if (actionLock.current) return;
    actionLock.current = true; setSaving(true); setActionError('');
    try {
      const saved = await usersApi.updateStatus(userId, newStatus);
      setUsers(prev => prev.map(u => u.id === userId ? saved : u));
      setSuccess('Account updated successfully.');
      setConfirmAction(null); setSelectedUser(null);
    } catch (err) {
      setActionError(err.message || 'Unable to update this account. Please try again.');
    } finally { actionLock.current = false; setSaving(false); }
  };

  const userStatusOptions = (currentUser) => {
    if (!currentUser || !canManage(currentUser)) return [];
    const currentStatus = currentUser?.status;
    const options = [];
    if (currentStatus === 'suspended') options.push({ label: 'Activate', status: 'active', color: 'bg-green-600 hover:bg-green-700' });
    if (currentStatus !== 'suspended') options.push({ label: 'Suspend', status: 'suspended', color: 'bg-yellow-600 hover:bg-yellow-700' });
    if (currentStatus === 'archived') options.push({ label: 'Restore', status: 'active', color: 'bg-green-600 hover:bg-green-700' });
    return options;
  };

  return (
    <div className="page page-users">
      <PageHeader title="Users" description={"Manage campus accounts and access."} />
      {success && <div className="ui-alert ui-alert-success" role="status">{success}</div>}

      <div className="ui-panel p-4 mb-6 ui-toolbar">
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-[200px]">
            <input aria-label="Search by name, email, or ID..." type="text" placeholder="Search by name, email, or ID..." value={search} onChange={(e) => setSearch(e.target.value)} className="ui-input w-full placeholder-gray-400" />
          </div>
          <select aria-label="status Filter" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="ui-input [&_option]:bg-white [&_option]:dark:bg-gray-800 [&_option]:text-gray-900 [&_option]:dark:text-white">
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>
      </div>

      <DataRegion loading={loading} error={pageError} onRetry={() => window.location.reload()} empty={filtered.length === 0}><div className="ui-panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="ui-table responsive-table w-full">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-700 border-b border-gray-100 dark:border-gray-600">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">User</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Student ID</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Department</th>

                <th>Joined</th><th>Role</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => (
                <tr key={u.id} className={`border-b border-gray-50 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 ${u.status === 'archived' ? 'opacity-60' : ''}`}>
                  <td data-label="User" className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium ${u.status === 'archived' ? 'bg-gray-200 dark:bg-gray-600 text-gray-500' : 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400'}`}>{u.name.charAt(0)}</div>
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{u.name}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td data-label="Student ID" className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{u.student_id || u.studentId}</td>
                  <td data-label="Department" className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{u.department}</td>

                  <td data-label="Joined" className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">{formatDateTime(u.join_date || u.joinDate)}</td>
                  <td data-label="Role" className="px-4 py-3">{accountRoleLabel(u.role)}</td><td data-label="Status" className="px-4 py-3"><StatusBadge status={u.status} /></td>
                  <td data-label="Actions" className="px-4 py-3 text-right">
                    <button type="button" disabled={saving} onClick={() => { setActionError(''); setSelectedUser(u); }} className="ui-button ui-button-link">View</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div></DataRegion>

      <Modal isOpen={!!selectedUser} onClose={() => { if (!actionLock.current) setSelectedUser(null); }} title="User Details" size="lg">
        {selectedUser && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold ${selectedUser.status === 'archived' ? 'bg-gray-200 dark:bg-gray-600 text-gray-500' : 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400'}`}>{selectedUser.name.charAt(0)}</div>
              <div>
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white">{selectedUser.name}</h4>
                <p className="text-sm text-gray-500 dark:text-gray-400">{selectedUser.email}</p>
                {isAdminRole(selectedUser.role) && <span className="text-xs bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 px-2 py-0.5 rounded-full font-medium">Admin</span>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><p className="text-xs text-gray-500 dark:text-gray-400">Student ID</p><p className="text-sm font-medium text-gray-900 dark:text-white">{selectedUser.student_id || selectedUser.studentId}</p></div>
              <div><p className="text-xs text-gray-500 dark:text-gray-400">Phone</p><p className="text-sm font-medium text-gray-900 dark:text-white">{selectedUser.phone}</p></div>
              <div><p className="text-xs text-gray-500 dark:text-gray-400">Department</p><p className="text-sm font-medium text-gray-900 dark:text-white">{selectedUser.department}</p></div>
              <div><p className="text-xs text-gray-500 dark:text-gray-400">Status</p><StatusBadge status={selectedUser.status} /></div>
              <div><p className="text-xs text-gray-500 dark:text-gray-400">Joined</p><p className="text-sm font-medium text-gray-900 dark:text-white">{formatDate(selectedUser.join_date || selectedUser.joinDate)}</p></div>
              <div><p className="text-xs text-gray-500 dark:text-gray-400">Last Active</p><p className="text-sm font-medium text-gray-900 dark:text-white">{formatDate(selectedUser.last_active || selectedUser.lastActive)}</p></div>
            </div>
            <div className="flex gap-2 pt-3 border-t border-gray-100 dark:border-gray-700">
              {userStatusOptions(selectedUser).map(opt => (
                <button type="button"
                  key={opt.status}
                  disabled={saving} onClick={() => { setActionError(''); setConfirmAction({ user: selectedUser, action: opt.status === 'active' ? (selectedUser.status === 'archived' ? 'restore' : 'activate') : 'suspend' }); }}
                  className={`ui-button flex-1 text-white py-2 rounded-lg text-sm font-medium ${opt.color} transition-colors`}
                >
                  {opt.label}
                </button>
              ))}
              {userStatusOptions(selectedUser).length === 0 && (
                <p className="text-sm text-gray-400 w-full text-center">{isAdminRole(selectedUser.role) ? 'Admin accounts are protected.' : 'No account actions are available.'}</p>
              )}
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={!!confirmAction} onClose={() => { if (!actionLock.current) setConfirmAction(null); }} title="Confirm account change" size="sm">{confirmAction && <>

            {actionError && <div className="ui-alert ui-alert-error mb-4" role="alert">{actionError}</div>}
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              {confirmAction.action === 'restore' && `Restore "${confirmAction.user.name}"? They will regain access to the system with active status.`}
              {confirmAction.action === 'suspend' && `Suspend "${confirmAction.user.name}"? They will be temporarily blocked from the system.`}
              {confirmAction.action === 'activate' && `Activate "${confirmAction.user.name}"? They will regain full access to the system.`}
            </p>
            <div className="flex justify-end gap-3">
              <button type="button" disabled={saving} onClick={() => { setActionError(''); setConfirmAction(null); }} className="ui-button ui-button-secondary">Cancel</button>
              <button type="button" disabled={saving}
                onClick={() => {
                  const statusMap = { restore: 'active', suspend: 'suspended', activate: 'active' };
                  handleStatusChange(confirmAction.user.id, statusMap[confirmAction.action]);
                }}
                className={`ui-button px-4 py-2 text-sm text-white rounded-lg ${
                  confirmAction.action === 'suspend' ? 'bg-yellow-600 hover:bg-yellow-700' :
                  'bg-green-600 hover:bg-green-700'
                }`}
              >
                {saving ? 'Saving...' : ''}
                {!saving && confirmAction.action === 'restore' && 'Restore'}
                {!saving && confirmAction.action === 'suspend' && 'Suspend'}
                {!saving && confirmAction.action === 'activate' && 'Activate'}
              </button>
            </div>
          </>}</Modal>
    </div>
  );
}
