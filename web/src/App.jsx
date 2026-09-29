import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppProvider } from './context/AppContext';
import ToastContainer from './components/common/Toast';
import Login from './pages/Login';
import DashboardLayout from './components/layout/DashboardLayout';
import Dashboard from './pages/Dashboard';
import LostItems from './pages/LostItems';
import FoundItems from './pages/FoundItems';
import SmartMatching from './pages/SmartMatching';
import ActivityLogs from './pages/ActivityLogs';
import Analytics from './pages/Analytics';
import Categories from './pages/Categories';
import Users from './pages/Users';
import QRLocations from './pages/QRLocations';
import Messaging from './pages/Messaging';
import UnclaimedItems from './pages/UnclaimedItems';
import Settings from './pages/Settings';
import Feedback from './pages/Feedback';

function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
}

function AppRoutes() {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <Login />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="items/lost" element={<LostItems />} />
        <Route path="items/found" element={<FoundItems />} />
        <Route path="matching" element={<SmartMatching />} />
        <Route path="activity-logs" element={<ActivityLogs />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="categories" element={<Categories />} />
        <Route path="users" element={<Users />} />
        <Route path="qr-locations" element={<QRLocations />} />
        <Route path="messaging" element={<Messaging />} />
        <Route path="unclaimed" element={<UnclaimedItems />} />
        <Route path="feedback" element={<Feedback />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppProvider>
          <AppRoutes />
          <ToastContainer />
        </AppProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}