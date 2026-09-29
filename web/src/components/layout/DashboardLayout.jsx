import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import { useAppSettings } from '../../context/AppContext';

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { settings } = useAppSettings();

  const textSizeClass = settings.textSize === 'large' ? 'text-large' : settings.textSize === 'xlarge' ? 'text-xlarge' : '';

  return (
    <div className={`flex h-screen ${settings.darkMode ? 'dark' : ''}`}>
      <div className={`flex h-screen w-full lf-bg-base ${settings.highContrast ? 'high-contrast' : ''} ${textSizeClass}`}>
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
          <main className="flex-1 overflow-y-auto lf-bg-main p-4 lg:p-6 dark:bg-gray-900" role="main">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
