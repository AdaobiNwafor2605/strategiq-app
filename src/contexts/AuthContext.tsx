import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../types';
import { supabase } from '../lib/supabase';

// Re-export so existing imports from AuthContext still work
export { supabase };

// SECURITY NOTE — httpOnly cookies:
// This app is a Vite SPA (no SSR). Vite cannot set httpOnly cookies from the frontend.
// Supabase stores the JWT in localStorage by default, which is the standard trade-off
// for a pure client-side React app. The actual security layer is:
//   1. JWT verification in FastAPI (python-jose checks every protected API request)
//   2. Supabase Row Level Security (auth.uid() = id on all profile queries)
//   3. Short token lifetime + refresh tokens handled automatically by Supabase
// Migrating to httpOnly cookies would require switching to Next.js App Router + @supabase/ssr.

type AuthEvent = 'PASSWORD_RECOVERY' | null;

export interface SignUpData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone?: string;
  country: string;
  currency: 'GBP' | 'USD' | 'EUR';
  brandName: string;
  brandSize: string;
  industrySegment: string;
  dateOfBirth?: string;
  referralSource?: string;
}

export interface ProfileUpdate {
  firstName?: string;
  lastName?: string;
  phone?: string;
  country?: string;
  currency?: 'GBP' | 'USD' | 'EUR';
  brandName?: string;
  brandSize?: string;
  industrySegment?: string;
  dateOfBirth?: string;
  referralSource?: string;
}

interface AuthContextType {
  user: User | null;
  unverifiedEmail: string | null;
  authEvent: AuthEvent;
  isLoading: boolean;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  signup: (data: SignUpData) => Promise<void>;
  logout: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  resetPassword: (newPassword: string) => Promise<void>;
  updateEmail: (newEmail: string) => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  updateProfile: (data: ProfileUpdate) => Promise<void>;
  markOnboardingSeen: () => Promise<void>;
  markCsvUploaded: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  clearAuthEvent: () => void;
  clearUnverifiedEmail: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

interface AuthProviderProps { children: ReactNode; }

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [authEvent, setAuthEvent] = useState<AuthEvent>(null);

  const buildUser = async (supabaseUser: any): Promise<User> => {
    // DATA ISOLATION: .eq('id', supabaseUser.id) + RLS policy "Users can read own profile"
    // guarantees this query only ever returns the calling user's row.
    // select('*') is resilient to missing columns before the SQL migration runs.
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', supabaseUser.id)
      .single();

    const firstName = profile?.first_name ?? supabaseUser.user_metadata?.firstName ?? '';
    const lastName = profile?.last_name ?? supabaseUser.user_metadata?.lastName ?? '';
    const displayName = [firstName, lastName].filter(Boolean).join(' ') || profile?.name || supabaseUser.email;

    // localStorage fallback so onboarding doesn't re-appear on refresh before SQL migration runs
    const localSeen = localStorage.getItem(`strategiq_seen_${supabaseUser.id}`) === 'true';

    return {
      id: supabaseUser.id,
      email: supabaseUser.email,
      emailVerified: !!supabaseUser.email_confirmed_at,
      name: displayName,
      firstName,
      lastName,
      phone: profile?.phone ?? undefined,
      country: profile?.country ?? 'United Kingdom',
      currency: (profile?.currency as 'GBP' | 'USD' | 'EUR') ?? 'GBP',
      brandName: profile?.brand_name ?? undefined,
      brandSize: profile?.brand_size ?? undefined,
      industrySegment: profile?.industry_segment ?? undefined,
      dateOfBirth: profile?.date_of_birth ?? undefined,
      referralSource: profile?.referral_source ?? undefined,
      plan: profile?.plan ?? 'micro',
      createdAt: profile?.created_at ?? supabaseUser.created_at,
      hasSeenOnboarding: profile?.has_seen_onboarding ?? localSeen,
      csvUploaded: profile?.csv_uploaded ?? false,
      brandDetailsComplete: profile?.brand_details_complete ?? false,
    };
  };

  // After email verification, write the pending profile data that was stored at signup time
  const flushPendingProfile = async (userId: string, email: string) => {
    const key = `strategiq_pending_profile_${email}`;
    const stored = localStorage.getItem(key);
    if (!stored) return;
    const pd = JSON.parse(stored);
    await supabase.from('profiles').upsert({
      id: userId,
      name: [pd.firstName, pd.lastName].filter(Boolean).join(' '),
      first_name: pd.firstName,
      last_name: pd.lastName,
      phone: pd.phone ?? null,
      country: pd.country,
      currency: pd.currency,
      brand_name: pd.brandName,
      brand_size: pd.brandSize,
      industry_segment: pd.industrySegment,
      date_of_birth: pd.dateOfBirth ?? null,
      referral_source: pd.referralSource ?? null,
    }, { onConflict: 'id' });
    localStorage.removeItem(key);
  };

  useEffect(() => {
    // `active` prevents the first StrictMode effect run's callbacks from
    // interfering with the second run after cleanup.
    let active = true;

    // Hard fallback: never leave the spinner running more than 8 seconds.
    const loadingTimer = setTimeout(() => {
      if (active) setIsLoading(false);
    }, 8000);

    // We rely solely on onAuthStateChange (which fires INITIAL_SESSION with the
    // current session on subscription). Calling getSession() separately would
    // create two concurrent lock acquisitions on the Supabase client in React
    // StrictMode, causing a deadlock where session restore never completes.
    //
    // setTimeout(0) is required here: Supabase v2 fires SIGNED_IN from inside
    // initialize()'s internal _acquireLock. Our buildUser() calls
    // supabase.from().select() which internally calls getSession() →
    // _acquireLock. Since the lock is already held, it deadlocks. Scheduling
    // via setTimeout(0) guarantees we run after initialize() releases the lock.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!active) return;

        if (event === 'PASSWORD_RECOVERY') {
          setAuthEvent('PASSWORD_RECOVERY');
          return;
        }

        setTimeout(async () => {
          if (!active) return;

          if (session?.user) {
            await flushPendingProfile(session.user.id, session.user.email!);
            const builtUser = await buildUser(session.user);
            if (active) {
              setUser(builtUser);
              setUnverifiedEmail(null);
            }
          } else if (active) {
            setUser(null);
          }

          // Clear loading after INITIAL_SESSION so the app can render.
          // SIGNED_IN / SIGNED_OUT / TOKEN_REFRESHED are post-login events
          // and don't need to touch isLoading (it's already false by then).
          if (active && event === 'INITIAL_SESSION') {
            setIsLoading(false);
          }
        }, 0);
      }
    );

    // Sign out on tab/window close if "remember me" was unchecked
    const handleUnload = () => {
      if (sessionStorage.getItem('strategiq_session_only') === 'true') {
        supabase.auth.signOut();
      }
    };
    window.addEventListener('beforeunload', handleUnload);

    return () => {
      active = false;
      clearTimeout(loadingTimer);
      subscription.unsubscribe();
      window.removeEventListener('beforeunload', handleUnload);
    };
  }, []);

  const login = async (email: string, password: string, rememberMe = true) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    if (!rememberMe) {
      sessionStorage.setItem('strategiq_session_only', 'true');
    } else {
      sessionStorage.removeItem('strategiq_session_only');
    }
    if (data.user) {
      const builtUser = await buildUser(data.user);
      setUser(builtUser);
    }
  };

  const signup = async (data: SignUpData) => {
    const { data: authData, error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: { firstName: data.firstName, lastName: data.lastName },
      },
    });
    if (error) throw new Error(error.message);

    // Store profile data in localStorage so it can be written after email verification
    localStorage.setItem(`strategiq_pending_profile_${data.email}`, JSON.stringify({
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone ?? null,
      country: data.country,
      currency: data.currency,
      brandName: data.brandName,
      brandSize: data.brandSize,
      industrySegment: data.industrySegment,
      dateOfBirth: data.dateOfBirth ?? null,
      referralSource: data.referralSource ?? null,
    }));

    if (!authData.session) {
      // Email confirmation required — session not active yet
      setUnverifiedEmail(data.email);
      return;
    }

    // Auto-confirmed — write profile and sign in immediately
    if (authData.user) {
      await flushPendingProfile(authData.user.id, authData.user.email!);
      const builtUser = await buildUser(authData.user);
      setUser(builtUser);
    }
  };

  const logout = async () => {
    if (user) localStorage.removeItem(`strategiq_seen_${user.id}`);
    await supabase.auth.signOut();
    sessionStorage.removeItem('strategiq_session_only');
    setUser(null);
  };

  const sendPasswordReset = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    if (error) throw new Error(error.message);
  };

  const resetPassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw new Error(error.message);
  };

  const updateEmail = async (newEmail: string) => {
    const { error } = await supabase.auth.updateUser({ email: newEmail });
    if (error) throw new Error(error.message);
  };

  const resendVerificationEmail = async () => {
    if (!unverifiedEmail) return;
    const { error } = await supabase.auth.resend({ type: 'signup', email: unverifiedEmail });
    if (error) throw new Error(error.message);
  };

  const updateProfile = async (data: ProfileUpdate) => {
    if (!user) return;
    const dbData: Record<string, any> = {};
    if (data.firstName !== undefined) dbData.first_name = data.firstName;
    if (data.lastName !== undefined) dbData.last_name = data.lastName;
    if (data.phone !== undefined) dbData.phone = data.phone;
    if (data.country !== undefined) dbData.country = data.country;
    if (data.currency !== undefined) dbData.currency = data.currency;
    if (data.brandName !== undefined) dbData.brand_name = data.brandName;
    if (data.brandSize !== undefined) dbData.brand_size = data.brandSize;
    if (data.industrySegment !== undefined) dbData.industry_segment = data.industrySegment;
    if (data.dateOfBirth !== undefined) dbData.date_of_birth = data.dateOfBirth;
    if (data.referralSource !== undefined) dbData.referral_source = data.referralSource;

    const newFirst = data.firstName ?? user.firstName;
    const newLast = data.lastName ?? user.lastName;
    dbData.name = [newFirst, newLast].filter(Boolean).join(' ');

    const brandName = data.brandName ?? user.brandName;
    const industrySegment = data.industrySegment ?? user.industrySegment;
    const country = data.country ?? user.country;
    if (brandName && industrySegment && country) dbData.brand_details_complete = true;

    // DATA ISOLATION: .eq('id', user.id) + RLS "Users can update own profile"
    const { error } = await supabase.from('profiles').update(dbData).eq('id', user.id);
    if (error) throw new Error(error.message);

    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const builtUser = await buildUser(session.user);
      setUser(builtUser);
    }
  };

  const markOnboardingSeen = async () => {
    if (!user) return;
    // localStorage fallback ensures onboarding doesn't re-appear on refresh before migration runs
    localStorage.setItem(`strategiq_seen_${user.id}`, 'true');
    await supabase.from('profiles').update({ has_seen_onboarding: true }).eq('id', user.id);
    setUser({ ...user, hasSeenOnboarding: true });
  };

  const markCsvUploaded = async () => {
    if (!user) return;
    await supabase.from('profiles').update({ csv_uploaded: true }).eq('id', user.id);
    setUser({ ...user, csvUploaded: true });
  };

  const deleteAccount = async () => {
    if (!user) return;

    // 1. Delete the profile row — the user's own JWT satisfies RLS.
    await supabase.from('profiles').delete().eq('id', user.id);

    // 2. Delete the auth.users record via the backend (service_role required).
    //    Without this the email stays reserved in Supabase and can't be reused.
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      const res = await fetch('/api/auth/account', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.detail ?? 'Failed to delete account. Please try again.');
      }
    }

    // 3. Sign out and clear local state.
    localStorage.removeItem(`strategiq_seen_${user.id}`);
    await supabase.auth.signOut();
    sessionStorage.removeItem('strategiq_session_only');
    setUser(null);
  };

  const clearAuthEvent = () => setAuthEvent(null);
  const clearUnverifiedEmail = () => setUnverifiedEmail(null);

  return (
    <AuthContext.Provider value={{
      user,
      unverifiedEmail,
      authEvent,
      isLoading,
      login,
      signup,
      logout,
      sendPasswordReset,
      resetPassword,
      updateEmail,
      resendVerificationEmail,
      updateProfile,
      markOnboardingSeen,
      markCsvUploaded,
      deleteAccount,
      clearAuthEvent,
      clearUnverifiedEmail,
    }}>
      {children}
    </AuthContext.Provider>
  );
};
