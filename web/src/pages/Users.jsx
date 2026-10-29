import AppIcon from '../components/common/AppIcon';
import { PageHeader, DataRegion } from '../components/common/UI';
import { useState, useMemo, useEffect } from 'react';
import { usersApi } from '../services/api';
import StatusBadge from '../components/common/StatusBadge';
import Modal from '../components/common/Modal';
import { formatDate, formatDateTime } from '../utils/formatters';

export default function Users() {
  const [pageError, setPageError] = useState('');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = () => {
    setLoading(true);
    usersApi.getAll().then(data => {
      setUsers(data);
    }).catch(err => setPageError(err.message || 'Unable to load this section.')).finally(() => setLoading(false));
  };
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
    try {
      await usersApi.updateStatus(userId, newStatus);
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, status: newStatus } : u));
    } catch (err) {
      console.error(err);
    }
    setConfirmAction(null);
    setSelectedUser(null);
  };

  const userStatusOptions = (currentUser) => {
    const currentStatus = currentUser?.status;
    const options = [];
    if (currentStatus !== 'active') options.push({ label: 'Activate', status: 'active', color: 'bg-green-600 hover:bg-green-700' });
    if (currentStatus !== 'suspended' && currentUser?.role !== 'superadmin') options.push({ label: 'Suspend', status: 'suspended', color: 'bg-yellow-600 hover:bg-yellow-700' });
    if (currentStatus !== 'archived' && currentUser?.role !== 'superadmin') options.push({ label: 'Archive', status: 'archived', color: 'bg-gray-600 hover:bg-gray-700' });
    if (currentStatus === 'archived') options.push({ label: 'Restore', status: 'active', color: 'bg-green-600 hover:bg-green-700' });
    return options;
  };

  return (
    <div className="page page-users">
      <PageHeader title="Users" description={"Manage campus accounts and access."} />

      <div className="ui-panel p-4 mb-6 ui-toolbar">
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-[200px]">
            <input aria-label="Search by name, email, or ID..." type="text" placeholder="Search by name, email, or ID..." value={search} onChange={(e) => setSearch(e.target.value)} className="ui-input w-full placeholder-gray-400" />
          </div>
          <select aria-label="status Filter" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="ui-input [&_option]:bg-white [&_option]:dark:bg-gray-800 [&_option]:text-gray-900 [&_option]:dark:text-white">
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
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

                <th>Reported</th>
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

                  <td data-label="Reported" className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">{formatDateTime(u.join_date || u.joinDate)}</td>
                  <td data-label="Status" className="px-4 py-3"><StatusBadge status={u.status} /></td>
                  <td data-label="Actions" className="px-4 py-3 text-right">
                    <button type="button" onClick={() => setSelectedUser(u)} className="ui-button ui-button-link mr-2">View</button>
                    {u.role !== 'superadmin' ? (
                      u.status !== 'archived' ? (
                        <button type="button" onClick={() => setConfirmAction({ user: u, action: 'archive' })} className="ui-button ui-button-secondary"><AppIcon name="box" /> Archive</button>
                      ) : (
                        <button type="button" onClick={() => setConfirmAction({ user: u, action: 'restore' })} className="ui-button ui-button-success"><AppIcon name="refresh" /> Restore</button>
                      )
                    ) : (
                      <span className="text-xs text-gray-400 dark:text-gray-500 italic"><AppIcon name="shield" /> Admin</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div></DataRegion>

      <Modal isOpen={!!selectedUser} onClose={() => setSelectedUser(null)} title="User Details" size="lg">
        {selectedUser && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold ${selectedUser.status === 'archived' ? 'bg-gray-200 dark:bg-gray-600 text-gray-500' : 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400'}`}>{selectedUser.name.charAt(0)}</div>
              <div>
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white">{selectedUser.name}</h4>
                <p className="text-sm text-gray-500 dark:text-gray-400">{selectedUser.email}</p>
                {selectedUser.role === 'superadmin' && <span className="text-xs bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 px-2 py-0.5 rounded-full font-medium">Super Admin</span>}
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
                  onClick={() => setConfirmAction({ user: selectedUser, action: opt.status === 'active' && selectedUser.status === 'archived' ? 'restore' : opt.status === 'active' ? 'activate' : opt.status })}
                  className={`ui-button flex-1 text-white py-2 rounded-lg text-sm font-medium ${opt.color} transition-colors`}
                >
                  {opt.label}
                </button>
              ))}
              {userStatusOptions(selectedUser).length === 0 && (
                <p className="text-sm text-gray-400 w-full text-center">No actions available for super admin</p>
              )}
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={!!confirmAction} onClose={() => setConfirmAction(null)} title="Confirm account change" size="sm">{confirmAction && <>

            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              {confirmAction.action === 'archive' && `Are you sure you want to archive "${confirmAction.user.name}"? They will no longer be able to use the system. You can restore them later.`}
              {confirmAction.action === 'restore' && `Restore "${confirmAction.user.name}"? They will regain access to the system with active status.`}
              {confirmAction.action === 'suspend' && `Suspend "${confirmAction.user.name}"? They will be temporarily blocked from the system.`}
              {confirmAction.action === 'activate' && `Activate "${confirmAction.user.name}"? They will regain full access to the system.`}
            </p>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setConfirmAction(null)} className="ui-button ui-button-secondary">Cancel</button>
              <button type="button"
                onClick={() => {
                  const statusMap = { archive: 'archived', restore: 'active', suspend: 'suspended', activate: 'active' };
                  handleStatusChange(confirmAction.user.id, statusMap[confirmAction.action]);
                }}
                className={`ui-button px-4 py-2 text-sm text-white rounded-lg ${
                  confirmAction.action === 'archive' ? 'bg-gray-600 hover:bg-gray-700' :
                  confirmAction.action === 'suspend' ? 'bg-yellow-600 hover:bg-yellow-700' :
                  'bg-green-600 hover:bg-green-700'
                }`}
              >
                {confirmAction.action === 'archive' && 'Archive'}
                {confirmAction.action === 'restore' && 'Restore'}
                {confirmAction.action === 'suspend' && 'Suspend'}
                {confirmAction.action === 'activate' && 'Activate'}
              </button>
            </div>
          </>}</Modal>
    </div>
  );
}
