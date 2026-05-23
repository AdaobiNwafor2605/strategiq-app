import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { BarChart, Upload, LayoutDashboard, Crown, User } from 'lucide-react';

interface HeaderProps {
  currentPage: string;
  onNavigate: (page: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ currentPage, onNavigate }) => {
  const { user, logout } = useAuth();

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <div className="flex-shrink-0 flex items-center space-x-2 cursor-pointer" onClick={() => onNavigate('upload')}>
              <Crown className="w-7 h-7 text-purple-600" />
              <span className="text-xl font-bold text-purple-600">StrategIQ</span>
            </div>

            <nav className="ml-8 flex space-x-1">
              <button
                onClick={() => onNavigate('upload')}
                className={`inline-flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  currentPage === 'upload' ? 'bg-purple-100 text-purple-700' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Upload className="w-4 h-4 mr-1.5" />
                Upload
              </button>

              <button
                onClick={() => onNavigate('dashboard')}
                className={`inline-flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  currentPage === 'dashboard' ? 'bg-purple-100 text-purple-700' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <LayoutDashboard className="w-4 h-4 mr-1.5" />
                Dashboard
              </button>

              <button
                onClick={() => onNavigate('analytics')}
                className={`inline-flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  currentPage === 'analytics' ? 'bg-purple-100 text-purple-700' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <BarChart className="w-4 h-4 mr-1.5" />
                Analytics
              </button>
            </nav>
          </div>

          <div className="flex items-center gap-1">
            {user && (
              <>
                <button
                  onClick={() => onNavigate('profile')}
                  className={`inline-flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    currentPage === 'profile' ? 'bg-purple-100 text-purple-700' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <User className="w-4 h-4 mr-1.5" />
                  {user.firstName || user.name || user.email}
                </button>
                <button
                  onClick={() => logout()}
                  className="px-3 py-2 rounded-md text-sm font-medium text-slate-500 hover:bg-slate-100 transition-colors"
                >
                  Logout
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
