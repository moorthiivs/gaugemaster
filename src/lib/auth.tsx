import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

export type User = {
  id: string;
  name: string;
  email: string;
  role: string;
  avatarUrl?: string;
  provider?: string;
};

export type AuthContextType = {
  user: User | null;
  token: string | null;
  loading: boolean;
  signInWithOAuth: () => Promise<void>;
  devEmailLogin: (email?: string) => Promise<void>;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = "auth_token";
const USER_KEY = "auth_user";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_KEY);
    const storedUser = localStorage.getItem(USER_KEY);
    if (storedToken && storedUser) {
      setToken(storedToken);
      try {
        setUser(JSON.parse(storedUser));
      } catch {
        setUser(null);
      }
    }
    setLoading(false);
  }, []);

  const signIn = async (profile: User) => {
    const devToken = "dev-token";
    localStorage.setItem(TOKEN_KEY, devToken);
    localStorage.setItem(USER_KEY, JSON.stringify(profile));
    setToken(devToken);
    setUser(profile);
  };

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      token,
      loading,
      signInWithOAuth: async () => {
        // In production, redirect to backend OAuth start URL.
        // For dev, simulate OAuth success with a mock user.
        await signIn({
          id: "1",
          name: "Dev Operator",
          email: "operator@example.com",
          role: "operator",
          avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=Dev%20Operator`,
          provider: "DevOAuth",
        });
      },
      devEmailLogin: async (email?: string) => {
        await signIn({
          id: "2",
          name: email?.split("@")[0] || "Demo User",
          email: email || "demo@example.com",
          role: "admin",
          avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(email || "Demo User")}`,
          provider: "EmailStub",
        });
      },
      signOut: () => {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        setToken(null);
        setUser(null);
      },
    }),
    [user, token, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
