import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import axios from "axios";

export type User = {
  id: string;
  name: string;
  email: string;
  role: string;
  avatarUrl?: string;
  provider?: string;
  companyId: string;
  isNewCustomer: boolean;
};

export type AuthContextType = {
  user: User | null;
  token: string | null;
  loading: boolean;
  isNewCustomer: boolean;
  signInWithGoogleToken: (token: string) => Promise<void>;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  signOut: () => void;
  setIsNewCustomer: (value: boolean) => void;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = "auth_token";
const USER_KEY = "auth_user";
const SETUP_KEY = "setupCompleted";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isNewCustomer, setIsNewCustomer] = useState(false);

  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_KEY);
    const storedUser = localStorage.getItem(USER_KEY);
    const setupCompleted = localStorage.getItem(SETUP_KEY);

    if (storedToken && storedUser) {
      setToken(storedToken);
      try {
        const parsedUser: User = JSON.parse(storedUser);
        setUser(parsedUser);
        // If user has onboarded in database OR localStorage, consider as existing
        setIsNewCustomer(!parsedUser.isNewCustomer && setupCompleted !== 'true' ? true : false);
      } catch {
        setUser(null);
        setIsNewCustomer(false);
      }
    }
    setLoading(false);
  }, []);

  const signIn = async (userData: User, token: string) => {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(userData));
    // Store setupCompleted as string 'true' if onboarded
    localStorage.setItem(SETUP_KEY, userData.isNewCustomer ? 'false' : 'true');

    setToken(token);
    setUser(userData);
    setIsNewCustomer(!userData.isNewCustomer); // true if user not onboarded
  };

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      token,
      loading,
      isNewCustomer,
      setIsNewCustomer,
      setUser,

      signInWithGoogleToken: async (idToken: string) => {
        try {
          const response = await axios.post(`/api/auth/google/token`, { token: idToken });
          const { accessToken, user } = response.data;

          const userObj: User = {
            id: user.sub,
            name: user.name,
            email: user.email,
            role: "operator",
            avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.name)}`,
            provider: "google",
            isNewCustomer: user.onboarded,
            companyId: user.companyId,
          };

          await signIn(userObj, accessToken);

        } catch (error: any) {
          console.error("Google login failed", error);
          throw new Error("Google login failed");
        }
      },

      signInWithPassword: async (email: string, password: string) => {
        try {
          const response = await axios.post(`/api/auth/login`, { email, password });
          const { accessToken, user } = response.data;

          const userObj: User = {
            id: user.sub,
            name: user.name,
            email: user.email,
            role: user.role || "operator",
            avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.name)}`,
            provider: "password",
            isNewCustomer: user.onboarded,
            companyId: user.companyId,
          };

          await signIn(userObj, accessToken);

        } catch (error: any) {
          const message =
            error.response?.data?.message ||
            error.message ||
            "Login failed. Please check your credentials and try again.";
          throw new Error(message);
        }
      },

      register: async (username: string, email: string, password: string) => {
        try {
          const response = await axios.post(`/api/auth/register`, { name: username, email, password });
          const { accessToken, user } = response.data;

          const userObj: User = {
            id: user.sub,
            name: user.name,
            email: user.email,
            role: user.role || "operator",
            avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.name)}`,
            provider: "password",
            isNewCustomer: user.onboarded,
            companyId: user.companyId,
          };

          await signIn(userObj, accessToken);

        } catch (error: any) {
          console.error("Registration failed", error);
          throw new Error(error?.response?.data?.message || "Registration failed");
        }
      },

      signOut: () => {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        localStorage.removeItem(SETUP_KEY);
        localStorage.removeItem('setupData');
        setToken(null);
        setUser(null);
        setIsNewCustomer(false);
      },
    }),
    [user, token, loading, isNewCustomer]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
