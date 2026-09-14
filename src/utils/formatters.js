export function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatDateTime(dateStr) {
  if (!dateStr) return 'N/A';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function timeAgo(dateStr) {
  if (!dateStr) return '';
  const now = new Date();
  const d = new Date(dateStr);
  const diffMs = now - d;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(dateStr);
}

export function getStatusColor(status) {
  const colors = {
    active: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300',
    potential_match: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300',
    matched: 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300',
    claimed: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300',
    resolved: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300',
    pending: 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300',
    approved: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300',
    rejected: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300',
    suspended: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300',
    inactive: 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300',
    good: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300',
    damaged: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300',
  };
  return colors[status] || 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300';
}

export function getPriorityColor(priority) {
  const colors = {
    high: 'bg-red-100 text-red-800',
    medium: 'bg-yellow-100 text-yellow-800',
    low: 'bg-green-100 text-green-800',
  };
  return colors[priority] || 'bg-gray-100 text-gray-800';
}

export function getNotificationIcon(type) {
  const icons = {
    new_item: '📦',
    match_found: '🔗',
    pending_storage: '⚠️',
    claim_handover: '✅',
    feedback: '💬',
    system_issue: '🔧',
  };
  return icons[type] || '📌';
}

export function formatConfidence(score) {
  return `${(score * 100).toFixed(0)}%`;
}

export function truncate(str, len = 50) {
  if (!str) return '';
  return str.length > len ? str.substring(0, len) + '...' : str;
}