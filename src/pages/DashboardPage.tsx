import React, { useEffect, useState } from 'react';
import { Loader2, Mail, User, Crown, Calendar } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardHeader } from '../components/ui/Card';

interface Profile {
  id: string;
  name: string | null;
  plan: string | null;
  created_at: string | null;
}

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    supabase
      .from('profiles')
      .select('id, name, plan, created_at')
      .eq('id', user.id)
      .single()
      .then(({ data, error: err }) => {
        if (err) setError(err.message);
        else setProfile(data);
        setLoading(false);
      });
  }, [user?.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Your Profile</h1>

      {error && (
        <div className="p-4 bg-red-50 text-red-600 rounded-lg text-sm">
          Could not load profile data: {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-slate-900">Account Details</h2>
        </CardHeader>
        <CardContent className="p-6 space-y-5">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 bg-purple-50 rounded-lg flex items-center justify-center flex-shrink-0">
              <Mail className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">Email</p>
              <p className="text-slate-900 font-medium">{user?.email}</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 bg-purple-50 rounded-lg flex items-center justify-center flex-shrink-0">
              <User className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">Name</p>
              <p className="text-slate-900 font-medium">{profile?.name ?? user?.name ?? '—'}</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 bg-purple-50 rounded-lg flex items-center justify-center flex-shrink-0">
              <Crown className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">Plan</p>
              <p className="text-slate-900 font-medium capitalize">{profile?.plan ?? user?.plan ?? '—'}</p>
            </div>
          </div>

          {profile?.created_at && (
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 bg-purple-50 rounded-lg flex items-center justify-center flex-shrink-0">
                <Calendar className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">Member since</p>
                <p className="text-slate-900 font-medium">
                  {new Date(profile.created_at).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
