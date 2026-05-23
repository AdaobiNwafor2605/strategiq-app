import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { BarChart, Upload, LayoutDashboard, Crown, User } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export const Header: React.FC = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const navItem = (path: string, label: string, Icon: React.ElementType) => (
    <button
      onClick={() => navigate(path)}
      className={`inline-flex items-center px-3 py-2 rounded-md text-sm font-medium ${
        pathname === path
          ? 'bg-purple-100 text-purple-700'
          : 'text-slate-600 hover:bg-slate-100'
      }`}
    >
      <Icon className="w-4 h-4 mr-2" />
      {label}
    </button>
  );

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
              {navItem('/upload', 'Upload Data', Upload)}
              {navItem('/app', 'Dashboard', LayoutDashboard)}
              {navItem('/analytics', 'Advanced Analytics', BarChart)}
            </nav>
          </div>

          <div className="flex items-center space-x-4">
            {user && (
              <>
                <button
                  onClick={() => navigate('/dashboard')}
                  className={`flex items-center space-x-1.5 text-sm ${
                    pathname === '/dashboard'
                      ? 'text-purple-700 font-medium'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <User className="w-4 h-4" />
                  <span>{user.email}</span>
                </button>
                <button
                  onClick={signOut}
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
