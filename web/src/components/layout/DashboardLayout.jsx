import { useState, Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { NotificationProvider } from '../../context/NotificationContext';
import Header from './Header';
import { LoadingState } from '../common/UI';
export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  return <NotificationProvider><div className="app-shell"><a href="#main-content" className="skip-link">Skip to content</a>
    <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
    <div className="workspace"><Header onToggleSidebar={() => setSidebarOpen(open => !open)} sidebarOpen={sidebarOpen} />
      <main id="main-content" className="workspace-main" tabIndex={-1}><div className="workspace-content"><Suspense fallback={<LoadingState label="Opening this section..." />}><Outlet /></Suspense></div></main>
    </div>
  </div></NotificationProvider>;
}
