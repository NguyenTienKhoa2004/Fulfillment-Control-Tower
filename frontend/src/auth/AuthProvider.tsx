import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Session } from '@supabase/supabase-js';
import { isMock, supabase } from './supabase';

interface AuthState {
  authenticated: boolean;
  loading: boolean;
  userId: string | null;
  authMessage: string;
  signOut: () => Promise<void>;
}
const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [authMessage, setAuthMessage] = useState('');
  const currentUser = useRef<string | null>(null);
  useEffect(() => {
    if (!supabase) return;
    let active = true;
    let authEventReceived = false;
    let previousUser: string | undefined;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => {
      authEventReceived = true;
      if (previousUser !== next?.user.id) queryClient.clear();
      previousUser = next?.user.id;
      currentUser.current = next?.user.id || null;
      if (next) setAuthMessage('');
      setSession(next);
      setLoading(false);
    });
    void supabase.auth.getSession().then(({ data }) => {
      if (active && !authEventReceived) {
        previousUser = data.session?.user.id;
        currentUser.current = data.session?.user.id || null;
        setSession(data.session);
        setLoading(false);
      }
    }).catch(() => { if (active) setLoading(false); });
    return () => { active = false; subscription.unsubscribe(); };
  }, [queryClient]);

  useEffect(() => {
    function expired(event: Event) {
      if (isMock) return;
      const rejectedUser = (event as CustomEvent<{ userId: string }>).detail?.userId;
      if (!rejectedUser || rejectedUser !== currentUser.current) return;
      setAuthMessage('Your session has expired. Please sign in again.');
      queryClient.clear();
      setSession(null);
      currentUser.current = null;
      void supabase?.auth.signOut({ scope: 'local' }).catch(() => undefined);
    }
    window.addEventListener('netcom:session-expired', expired);
    return () => window.removeEventListener('netcom:session-expired', expired);
  }, [queryClient]);

  async function signOut() {
    if (supabase) {
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      if (error) throw error;
    }
    queryClient.clear();
    setSession(null);
    currentUser.current = null;
    setAuthMessage('');
  }

  return <AuthContext.Provider value={{ authenticated: isMock || Boolean(session), loading,
    userId: isMock ? 'mock-logistics' : session?.user.id || null, authMessage, signOut }}>
    {children}
  </AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('AuthProvider is missing.');
  return context;
}
