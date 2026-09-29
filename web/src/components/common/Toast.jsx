import { useState, useEffect, useCallback } from 'react';

let toastListeners = [];

export function showToast(message, type = 'success', title = '') {
  toastListeners.forEach(fn => fn({ message, type, title, id: Date.now() }));
}

export default function ToastContainer() {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((toast) => {
    setToasts(prev => [...prev, toast]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== toast.id));
    }, 5000);
  }, []);

  useEffect(() => {
    toastListeners.push(addToast);
    return () => {
      toastListeners = toastListeners.filter(fn => fn !== addToast);
    };
  }, [addToast]);

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-3 max-w-md">
      {toasts.map(toast => (
        <div
          key={toast.id}
          onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
          className={`p-4 rounded-xl shadow-lg border cursor-pointer animate-slide-in flex items-start gap-3 ${
            toast.type === 'success' ? 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800' :
            toast.type === 'error' ? 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800' :
            toast.type === 'info' ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800' :
            'bg-yellow-50 dark:bg-yellow-900/30 border-yellow-200 dark:border-yellow-800'
          }`}
        >
          <span className="text-xl flex-shrink-0">
            {toast.type === 'success' ? '✅' : toast.type === 'error' ? '❌' : toast.type === 'info' ? 'ℹ️' : '⚠️'}
          </span>
          <div className="flex-1 min-w-0">
            {toast.title && (
              <p className={`text-sm font-semibold ${
                toast.type === 'success' ? 'text-green-800 dark:text-green-300' :
                toast.type === 'error' ? 'text-red-800 dark:text-red-300' :
                'text-gray-800 dark:text-white'
              }`}>
                {toast.title}
              </p>
            )}
            <p className={`text-sm ${toast.type === 'success' ? 'text-green-700 dark:text-green-400' : toast.type === 'error' ? 'text-red-700 dark:text-red-400' : toast.type === 'info' ? 'text-blue-700 dark:text-blue-400' : 'text-yellow-700 dark:text-yellow-400'}`}>
              {toast.message}
            </p>
          </div>
          <button className="text-gray-400 hover:text-gray-600 text-sm flex-shrink-0">✕</button>
        </div>
      ))}
    </div>
  );
}