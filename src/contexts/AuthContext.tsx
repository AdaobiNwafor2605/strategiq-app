import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { createClient } from '@supabase/supabase-js';
import { User } from '../types';

// Public client only: anon or publishable key in VITE_SUPABASE_ANON_KEY — never service_role / secrets.
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// Export supabase client so other parts of the app can use it
export { supabase };

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true); // true on mount while we check session

  // Helper: fetch the profile row and merge it into a User object
  const buildUser = async (supabaseUser: any): Promise<User> => {
    const { data: profile } = await supabase
      .from('profiles')
      .select('name, plan, created_at')
      .eq('id', supabaseUser.id)
      .single();

    return {
      id: supabaseUser.id,
      email: supabaseUser.email,
      name: profile?.name ?? supabaseUser.email,
      plan: profile?.plan ?? 'micro',
      createdAt: profile?.created_at ?? supabaseUser.created_at,
    };
  };

  // On mount: restore session if the user was previously logged in
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const builtUser = await buildUser(session.user);
        setUser(builtUser);
      }
      setIsLoading(false);
    });

    // Keep user in sync if the token refreshes or they log out in another tab
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session?.user) {
          const builtUser = await buildUser(session.user);
          setUser(builtUser);
        } else {
          setUser(null);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setIsLoading(false);
      throw new Error(error.message); // let your UI catch and display this
    }
    const builtUser = await buildUser(data.user);
    setUser(builtUser);
    setIsLoading(false);
  };

  const signup = async (email: string, password: string, name: string) => {
    setIsLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name } // passed to the trigger as raw_user_meta_data
      }
    });
    if (error) {
      setIsLoading(false);
      throw new Error(error.message);
    }
    if (data.user) {
      const builtUser = await buildUser(data.user);
      setUser(builtUser);
    }
    setIsLoading(false);
  };

  const logout = () => {
    supabase.auth.signOut();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, signup, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};