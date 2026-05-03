import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LandingPage } from './components/landing/LandingPage';
import { AuthForm } from './components/auth/AuthForm';
import { Header } from './components/layout/Header';
import { Dashboard } from './components/dashboard/Dashboard';
import { DataUpload } from './components/upload/DataUpload';
import { Analytics } from './components/analytics/Analytics';
import { PremiumFeatures } from './components/analytics/PremiumFeatures';

type Page = 'landing' | 'auth' | 'dashboard' | 'upload' | 'analytics' | 'premium';

const AppContent: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<Page>('landing');
  const [dashboardData, setDashboardData] = useState<any>(null);
  const { user } = useAuth();

  // Handle navigation based on user login status
  useEffect(() => {
    if (!user && currentPage !== 'auth') {
      setCurrentPage('landing');
    } else if (user && (currentPage === 'landing' || currentPage === 'auth')) {
      // Redirect to upload page after successful login/signup
      setCurrentPage('upload');
    }
  }, [user]);

  const handleNavigate = (page: Page) => {
    setCurrentPage(page);
  };

  const handleProcessedData = (data: any) => {
    setDashboardData(data);
    setCurrentPage('dashboard');
  };

  // If not logged in, show landing or auth
  if (!user) {
    return (
      <>
        {currentPage === 'landing' && <LandingPage onGetStarted={() => setCurrentPage('auth')} />}
        {currentPage === 'auth' && <AuthForm onBack={() => setCurrentPage('landing')} />}
      </>
    );
  }

  // If logged in, show the app interface with header
  return (
    <div className="min-h-screen bg-slate-50">
      <Header onNavigate={(page) => handleNavigate(page as Page)} currentPage={currentPage} />
      
      <main className="container mx-auto px-4 py-6">
        {currentPage === 'dashboard' && (
          <Dashboard data={dashboardData} />
        )}
        
        {currentPage === 'upload' && (
          <DataUpload onProcessed={handleProcessedData} />
        )}
        
        {currentPage === 'analytics' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-2xl font-semibold text-slate-900 mb-4">
                Advanced Analytics
              </h2>
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