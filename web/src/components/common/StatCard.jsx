export default function StatCard({ title, value, icon, color, subtitle, trend, onClick }) {
  const colorMap = {
    indigo: 'bg-indigo-500',
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    yellow: 'bg-yellow-500',
    red: 'bg-red-500',
    // Keep the dashboard brand accent consistent; status colors remain semantic.
    purple: 'bg-indigo-500',
    teal: 'bg-teal-500',
    pink: 'bg-pink-500',
    orange: 'bg-orange-500',
  };

  const bgColor = colorMap[color] || 'bg-indigo-500';

  return (
    <div
      onClick={onClick}
      className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 hover:shadow-md dark:hover:shadow-black/20 transition-all cursor-pointer border-t-4 ${
        color === 'green' ? 'border-t-green-500' : color === 'yellow' ? 'border-t-yellow-500' : color === 'blue' ? 'border-t-blue-500' : 'border-t-indigo-500'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{title}</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">{value}</p>
          {subtitle && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{subtitle}</p>
          )}
          {trend !== undefined && (
            <p className={`text-sm mt-1 ${trend >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}% from last month
            </p>
          )}
        </div>
        <div className={`${bgColor} rounded-lg p-3 text-white text-2xl`}>
          {icon}
        </div>
      </div>
    </div>
  );
}
