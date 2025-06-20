import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { BarChart, Upload, LayoutDashboard, Crown } from 'lucide-react';

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
            <div className="flex-shrink-0 flex items-center space-x-2">
              <Crown className="w-8 h-8 text-purple-600" />
              <span className="text-2xl font-bold text-purple-600">StrategIQ</span>
            </div>
            
            <nav className="ml-10 flex space-x-4">
              <button
                onClick={() => onNavigate('upload')}
                className={`inline-flex items-center px-3 py-2 rounded-md text-sm font-medium ${
                  currentPage === 'upload'
                    ? 'bg-purple-100 text-purple-700'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Upload className="w-4 h-4 mr-2" />
                Upload Data
              </button>
              
              <button
                onClick={() => onNavigate('dashboard')}
                className={`inline-flex items-center px-3 py-2 rounded-md text-sm font-medium ${
                  currentPage === 'dashboard'
                    ? 'bg-purple-100 text-purple-700'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <LayoutDashboard className="w-4 h-4 mr-2" />
                Dashboard
              </button>
              
              <button
                onClick={() => onNavigate('analytics')}
                className={`inline-flex items-center px-3 py-2 rounded-md text-sm font-medium ${
                  currentPage === 'analytics'
                    ? 'bg-purple-100 text-purple-700'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <BarChart className="w-4 h-4 mr-2" />
                Advanced Analytics
              </button>
            </nav>
          </div>
          
          <div className="flex items-center space-x-4">
            {user && (
              <>
                <span className="text-sm text-slate-600">
                  {user.email}
                </span>
                <button
                  onClick={logout}
                  className="px-3 py-2 rounded-md text-sm font-medium text-slate-600 hover:bg-slate-100"
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