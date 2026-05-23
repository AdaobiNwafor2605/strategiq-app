import React from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { LandingPage } from './components/landing/LandingPage';
import { AuthForm } from './components/auth/AuthForm';
import { Header } from './components/layout/Header';
import { Dashboard } from './components/dashboard/Dashboard';
import { DataUpload } from './components/upload/DataUpload';
import { Analytics } from './components/analytics/Analytics';
import { PremiumFeatures } from './components/analytics/PremiumFeatures';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { DashboardPage } from './pages/DashboardPage';
import { ProcessingMetrics } from './types';

// ── Shared layout for all authenticated pages ─────────────────────────────────
const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="min-h-screen bg-slate-50">
    <Header />
    <main className="container mx-auto px-4 py-6">{children}</main>
  </div>
);

// ── Public pages ──────────────────────────────────────────────────────────────

const LandingRoute: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  if (user) return <Navigate to="/upload" replace />;
  return <LandingPage onGetStarted={() => navigate('/login')} />;
};

const LoginRoute: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  if (user) return <Navigate to="/upload" replace />;
  return <AuthForm onBack={() => navigate('/')} />;
};

// ── Protected pages ───────────────────────────────────────────────────────────

const UploadRoute: React.FC = () => {
  const navigate = useNavigate();
  const handleProcessed = (data: ProcessingMetrics) => {
    localStorage.setItem('dashboardMetrics', JSON.stringify(data));
    navigate('/app');
  };
  return <DataUpload onProcessed={handleProcessed} />;
};

const AppRoute: React.FC = () => {
  const raw = localStorage.getItem('dashboardMetrics');
  const data: ProcessingMetrics | null = raw ? JSON.parse(raw) : null;
  return <Dashboard data={data} />;
};

const AnalyticsRoute: React.FC = () => {
  const navigate = useNavigate();
  const raw = localStorage.getItem('dashboardMetrics');
  const data: ProcessingMetrics | null = raw ? JSON.parse(raw) : null;

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-2xl font-semibold text-slate-900 mb-4">Advanced Analytics</h2>
      {!data ? (
        <div className="text-center py-12">
          <p className="text-slate-600 mb-4">Upload your data to unlock advanced analytics insights</p>
          <button
            onClick={() => navigate('/upload')}
            className="inline-flex items-center px-4 py-2 rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
          >
            Upload Data
          </button>
        </div>
      ) : (
        <Analytics data={data} onPremiumFeaturesClick={() => navigate('/premium')} />
      )}
    </div>
  );
};

const PremiumRoute: React.FC = () => {
  const navigate = useNavigate();
  return <PremiumFeatures onBackClick={() => navigate('/analytics')} />;
};

// ── Root ──────────────────────────────────────────────────────────────────────

function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingRoute />} />
      <Route path="/login" element={<LoginRoute />} />

      {/* All routes below require authentication */}
      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard" element={<AppLayout><DashboardPage /></AppLayout>} />
        <Route path="/upload"    element={<AppLayout><UploadRoute /></AppLayout>} />
        <Route path="/app"       element={<AppLayout><AppRoute /></AppLayout>} />
        <Route path="/analytics" element={<AppLayout><AnalyticsRoute /></AppLayout>} />
        <Route path="/premium"   element={<AppLayout><PremiumRoute /></AppLayout>} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
