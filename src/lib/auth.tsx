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
  signInWithProvider: (provider: "google" | "github") => Promise<void>;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  register: (params: { username: string; email: string; password: string }) => Promise<void>;
  devEmailLogin: (email?: string) => Promise<void>;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = "auth_token";
const USER_KEY = "auth_user";
const USERS_KEY = "auth_users";

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
        // For dev, simulate OAuth success with a mock Google user.
        await signIn({
          id: "1",
          name: "Dev Google User",
          email: "google.user@example.com",
          role: "operator",
          avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=Dev%20Google%20User`,
          provider: "google",
        });
      },
      signInWithProvider: async (provider: "google" | "github") => {
        const profiles = {
          google: {
            id: "g-1",
            name: "Google User",
            email: "google.user@example.com",
            role: "operator",
            avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=Google%20User`,
            provider: "google",
          },
          github: {
            id: "gh-1",
            name: "GitHub User",
            email: "github.user@example.com",
            role: "admin",
            avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=GitHub%20User`,
            provider: "github",
          },
        } as const;
        await signIn(profiles[provider]);
      },
      signInWithPassword: async (email: string, password: string) => {
        const usersRaw = localStorage.getItem(USERS_KEY);
        const users: Array<{ id: string; username: string; email: string; password: string; role: string }> = usersRaw
          ? JSON.parse(usersRaw)
          : [];
        const existing = users.find((u) => u.email === email && u.password === password);
        if (!existing) throw new Error("Invalid email or password");
        await signIn({
          id: existing.id,
          name: existing.username,
          email: existing.email,
          role: existing.role,
          avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(existing.username)}`,
          provider: "password",
        });
      },
      register: async ({ username, email, password }) => {
        const usersRaw = localStorage.getItem(USERS_KEY);
        const users: Array<{ id: string; username: string; email: string; password: string; role: string }> = usersRaw
          ? JSON.parse(usersRaw)
          : [];
        const exists = users.some((u) => u.email === email);
        if (exists) throw new Error("Email already registered");
        const newUser = { id: crypto.randomUUID(), username, email, password, role: "operator" };
        const updated = [...users, newUser];
        localStorage.setItem(USERS_KEY, JSON.stringify(updated));
        await signIn({
          id: newUser.id,
          name: username,
          email,
          role: newUser.role,
          avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(username)}`,
          provider: "password",
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
