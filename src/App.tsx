import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LandingPage } from './components/landing/LandingPage';
import { LoginForm } from './components/auth/LoginForm';
import { SignUpForm } from './components/auth/SignUpForm';
import { ForgotPasswordForm } from './components/auth/ForgotPasswordForm';
import { ResetPasswordForm } from './components/auth/ResetPasswordForm';
import { VerifyEmailScreen } from './components/auth/VerifyEmailScreen';
import { OnboardingScreen } from './components/onboarding/OnboardingScreen';
import { ProfilePage } from './components/profile/ProfilePage';
import { Header } from './components/layout/Header';
import { Dashboard } from './components/dashboard/Dashboard';
import { DataUploadV2 } from './components/upload/DataUploadV2';
import { Analytics } from './components/analytics/Analytics';
import { PremiumFeatures } from './components/analytics/PremiumFeatures';

type Page =
  | 'landing'
  | 'login'
  | 'signup'
  | 'forgot-password'
  | 'reset-password'
  | 'verify-email'
  | 'onboarding'
  | 'dashboard'
  | 'upload'
  | 'analytics'
  | 'premium'
  | 'profile';

const PROTECTED: Page[] = ['dashboard', 'upload', 'analytics', 'premium', 'profile', 'onboarding'];

const AppContent: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<Page>('landing');
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [uploadedAt, setUploadedAt] = useState<string | null>(null);
  const [isSampleData, setIsSampleData] = useState(false);
  // Remember where a logged-out user was trying to go, so we can send them there after login
  const [intendedPage, setIntendedPage] = useState<Page | null>(null);
  const { user, unverifiedEmail, authEvent, clearAuthEvent, isLoading } = useAuth();

  useEffect(() => {
    // Password reset link clicked — Supabase fires PASSWORD_RECOVERY event
    if (authEvent === 'PASSWORD_RECOVERY') {
      setCurrentPage('reset-password');
      clearAuthEvent();
      return;
    }

    // Not logged in, not awaiting verification
    if (!user && !unverifiedEmail) {
      if (PROTECTED.includes(currentPage)) {
        setIntendedPage(currentPage); // remember where they wanted to go
        setCurrentPage('landing');
      }
      return;
    }

    // Signed up but email not yet verified
    if (!user && unverifiedEmail) {
      setCurrentPage('verify-email');
      return;
    }

    // Logged in — redirect away from public pages
    if (user) {
      const onPublicPage = ['landing', 'login', 'signup', 'forgot-password', 'verify-email'].includes(currentPage);
      if (onPublicPage) {
        if (!user.hasSeenOnboarding) {
          setCurrentPage('onboarding');
        } else if (intendedPage) {
          // Send them to the page they originally tried to visit
          setCurrentPage(intendedPage);
          setIntendedPage(null);
        } else {
          setCurrentPage('upload');
        }
      }
    }
  }, [user, unverifiedEmail, authEvent]);

  const handleNavigate = (page: string) => setCurrentPage(page as Page);

  const handleProcessedData = (data: any, at: string, sample: boolean) => {
    setDashboardData(data);
    setUploadedAt(at);
    setIsSampleData(sample);
    setCurrentPage('dashboard');
  };

  const handleClearSampleData = () => {
    setIsSampleData(false);
    setDashboardData(null);
    setUploadedAt(null);
  };

  // Session restoring
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
      </div>
    );
  }

  // Password reset page (user arrives from email link — Supabase grants a temporary session)
  if (currentPage === 'reset-password') {
    return <ResetPasswordForm onSuccess={() => setCurrentPage('upload')} />;
  }

  // Email verification waiting screen
  if (currentPage === 'verify-email' || (!user && unverifiedEmail)) {
    return <VerifyEmailScreen />;
  }

  // Public pages — not logged in
  if (!user) {
    return (
      <>
        {currentPage === 'landing' && (
          <LandingPage
            onGetStarted={() => setCurrentPage('signup')}
            onLogin={() => setCurrentPage('login')}
          />
        )}
        {currentPage === 'login' && (
          <LoginForm
            onBack={() => setCurrentPage('landing')}
            onNavigateToSignUp={() => setCurrentPage('signup')}
            onNavigateToForgotPassword={() => setCurrentPage('forgot-password')}
          />
        )}
        {currentPage === 'signup' && (
          <SignUpForm
            onBack={() => setCurrentPage('landing')}
            onNavigateToLogin={() => setCurrentPage('login')}
          />
        )}
        {currentPage === 'forgot-password' && (
          <ForgotPasswordForm onBack={() => setCurrentPage('login')} />
        )}
      </>
    );
  }

  // First login onboarding
  if (currentPage === 'onboarding') {
    return <OnboardingScreen onNavigate={handleNavigate} />;
  }

  // Protected app
  return (
    <div className="min-h-screen bg-slate-50">
      <Header onNavigate={handleNavigate} currentPage={currentPage} />

      <main className="container mx-auto px-4 py-6">
        {currentPage === 'upload' && (
          <DataUploadV2
            onProcessed={handleProcessedData}
            isSampleData={isSampleData}
            onClearSampleData={handleClearSampleData}
          />
        )}

        {currentPage === 'dashboard' && (
          <Dashboard data={dashboardData} uploadedAt={uploadedAt} isSampleData={isSampleData} />
        )}

        {currentPage === 'profile' && (
          <ProfilePage />
        )}

        {currentPage === 'analytics' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-2xl font-semibold text-slate-900 mb-4">Advanced Analytics</h2>
              {!dashboardData ? (
                <div className="text-center py-12">
                  <p className="text-slate-600 mb-4">
                    Upload your data to unlock advanced analytics insights
                  </p>
                  <button
                    onClick={() => handleNavigate('upload')}
                    className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
                  >
                    Upload Data
                  </button>
                </div>
              ) : (
                <Analytics
                  data={dashboardData}
                  onPremiumFeaturesClick={() => handleNavigate('premium')}
                />
              )}
            </div>
          </div>
        )}

        {currentPage === 'premium' && (
          <PremiumFeatures onBackClick={() => handleNavigate('analytics')} />
        )}
      </main>
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
