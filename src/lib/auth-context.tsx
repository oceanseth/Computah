"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { getInsforgeBrowser } from "./insforge-client";

type AuthUser = { id: string; email: string; name?: string | null };

type AuthState = {
  user: AuthUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState>({
  user: null,
  loading: true,
  refresh: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const insforge = getInsforgeBrowser();
    const { data, error } = await insforge.auth.getCurrentUser();
    setUser(error ? null : ((data?.user as AuthUser | undefined) ?? null));
    setLoading(false);
  }, []);

  const signOut = useCallback(async () => {
    await getInsforgeBrowser().auth.signOut();
    setUser(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const insforge = getInsforgeBrowser();
      const { data, error } = await insforge.auth.getCurrentUser();
      if (cancelled) return;
      setUser(error ? null : ((data?.user as AuthUser | undefined) ?? null));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, refresh, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
