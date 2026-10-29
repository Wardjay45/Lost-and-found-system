import { lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppProvider } from './context/AppContext';
import ToastContainer from './components/common/Toast';
import { LoadingState } from './components/common/UI';
import Login from './pages/Login';
import DashboardLayout from './components/layout/DashboardLayout';
const Dashboard = lazy(() => import('./pages/Dashboard'));
const LostItems = lazy(() => import('./pages/LostItems'));
const FoundItems = lazy(() => import('./pages/FoundItems'));
const SmartMatching = lazy(() => import('./pages/SmartMatching'));
const PotentialMatches = lazy(() => import('./pages/PotentialMatches'));
const ClaimedItems = lazy(() => import('./pages/ClaimedItems'));
const ActivityLogs = lazy(() => import('./pages/ActivityLogs'));
const Analytics = lazy(() => import('./pages/Analytics'));
const Categories = lazy(() => import('./pages/Categories'));
const Users = lazy(() => import('./pages/Users'));
const QRLocations = lazy(() => import('./pages/QRLocations'));
const Messaging = lazy(() => import('./pages/Messaging'));
const UnclaimedItems = lazy(() => import('./pages/UnclaimedItems'));
const Settings = lazy(() => import('./pages/Settings'));
const Feedback = lazy(() => import('./pages/Feedback'));

function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
}

function AppRoutes() {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <LoadingState label="Opening your workspace..." />;

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
        <Route path="items/potential-matches" element={<PotentialMatches />} />
        <Route path="items/claimed" element={<ClaimedItems />} />
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