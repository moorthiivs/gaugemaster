import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import axios from "axios";

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
  signInWithGoogleToken: (token: string) => Promise<void>;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
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

  const signIn = async (userData: User, token: string) => {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(userData));
    setToken(token);
    setUser(userData);
  };

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      token,
      loading,

      signInWithGoogleToken: async (idToken: string) => {
        try {
          const response = await axios.post(`${(window as any).API_URL}/auth/google/token`, {
            token: idToken,
          });

          const { accessToken, user } = response.data;

          console.log(user, "user");

          await signIn(
            {
              id: user.sub,
              name: user.name,
              email: user.email,
              role: "operator",
              avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.name)}`,
              provider: "google",
            },
            accessToken
          );
        } catch (error: any) {
          console.error("Google login failed", error);
          throw new Error("Google login failed");
        }
      },


      signInWithPassword: async (email: string, password: string) => {
        try {
          const response = await axios.post(`${(window as any).API_URL}/auth/login`, {
            email,
            password,
          });

          const { accessToken, user } = response.data

          await signIn(
            {
              id: user.sub,
              name: user.name,
              email: user.email,
              role: user.role || "operator",
              avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.name)}`,
              provider: "password",
            },
            accessToken
          );
        } catch (error: any) {
          // If server returns an error message, use it; else fallback
          const message =
            error.response?.data?.message ||
            error.message || "Login failed. Please check your credentials and try again.";
          throw new Error(message);
        }
      },

      register: async (username: string, email: string, password: string) => {
        try {
          const response = await axios.post(`${(window as any).API_URL}/auth/register`, {
            name: username,
            email,
            password,
          });

          const { accessToken, user } = response.data;

          await signIn(
            {
              id: user.sub,
              name: user.name,
              email: user.email,
              role: user.role || "operator",
              avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.name)}`,
    provider: "password",
            },
accessToken
          );
        } catch (error: any) {
  console.error("Registration failed", error);
  throw new Error(error?.response?.data?.message || "Registration failed");
}
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
