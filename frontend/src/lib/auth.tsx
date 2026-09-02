import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import axios from "axios";
import { API_URL, TOKEN_KEY, REFRESH_TOKEN_KEY, USER_KEY, SETUP_KEY, INSPECTED_COMPANY_KEY } from "./httpClient";

export type User = {
  id: string;
  name: string;
  email: string;
  role: string | any;
  userRole?: any;
  designation?: string;
  signature?: string;
  additionalEmails?: string[];
  avatarUrl?: string;
  provider?: string;
  companyId: string;
  isNewCustomer: boolean;
  isSuperAdmin?: boolean;
  companyAccess?: {
    status: string;
    startDate: string | null;
    expiryDate: string | null;
  } | null;
};

export type AuthContextType = {
  user: User | null;
  token: string | null;
  loading: boolean;
  isNewCustomer: boolean;
  inspectedCompany: { id: string; name: string } | null;
  setInspectedCompany: (company: { id: string; name: string } | null) => void;
  signInWithGoogleToken: (token: string) => Promise<void>;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  signOut: () => void;
  setIsNewCustomer: (value: boolean) => void;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isNewCustomer, setIsNewCustomer] = useState(false);
  const [inspectedCompany, setInspectedCompanyState] = useState<{ id: string; name: string } | null>(() => {
    try {
      const stored = localStorage.getItem(INSPECTED_COMPANY_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const setInspectedCompany = (company: { id: string; name: string } | null) => {
    setInspectedCompanyState(company);
    if (company) {
      localStorage.setItem(INSPECTED_COMPANY_KEY, JSON.stringify(company));
    } else {
      localStorage.removeItem(INSPECTED_COMPANY_KEY);
    }
  };

  const signOut = useCallback(async () => {
    try {
      if (token) {
        await axios.post(`${API_URL}/auth/logout`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
    } catch (err) {
      console.error("Failed to call logout endpoint", err);
    }
    
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(SETUP_KEY);
    localStorage.removeItem("setupData");
    localStorage.removeItem(INSPECTED_COMPANY_KEY);
    setToken(null);
    setUser(null);
    setInspectedCompanyState(null);
    setIsNewCustomer(false);
  }, [token]);

  // Initialize auth state on mount
  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_KEY);
    const storedUser = localStorage.getItem(USER_KEY);
    const setupCompleted = localStorage.getItem(SETUP_KEY);

    if (storedToken && storedUser) {
      setToken(storedToken);
      try {
        const parsedUser: User = JSON.parse(storedUser);
        setUser(parsedUser);
        setIsNewCustomer(!parsedUser.isNewCustomer && setupCompleted !== "true" ? true : false);
      } catch {
        setUser(null);
        setIsNewCustomer(false);
      }
    }
    setLoading(false);
  }, []);

  // Listen for custom token refresh and session expired events
  useEffect(() => {
    const handleSessionExpiredEvent = () => {
      signOut();
    };

    const handleTokenRefreshedEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ token: string; user?: any }>;
      if (customEvent.detail?.token) {
        setToken(customEvent.detail.token);
      }
      if (customEvent.detail?.user) {
        setUser((prev) => (prev ? { ...prev, ...customEvent.detail.user } : customEvent.detail.user));
      }
    };

    // Cross-tab synchronization
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === TOKEN_KEY && !e.newValue) {
        signOut();
      } else if (e.key === TOKEN_KEY && e.newValue) {
        setToken(e.newValue);
        const storedUser = localStorage.getItem(USER_KEY);
        if (storedUser) {
          try {
            setUser(JSON.parse(storedUser));
          } catch {}
        }
      }
    };

    window.addEventListener("auth:session-expired", handleSessionExpiredEvent);
    window.addEventListener("auth:token-refreshed", handleTokenRefreshedEvent);
    window.addEventListener("storage", handleStorageChange);

    return () => {
      window.removeEventListener("auth:session-expired", handleSessionExpiredEvent);
      window.removeEventListener("auth:token-refreshed", handleTokenRefreshedEvent);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [signOut]);

  const signIn = async (userData: User, accessToken: string, refreshToken?: string) => {
    localStorage.setItem(TOKEN_KEY, accessToken);
    if (refreshToken) {
      localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    }
    localStorage.setItem(USER_KEY, JSON.stringify(userData));
    localStorage.setItem(SETUP_KEY, userData.isNewCustomer ? "false" : "true");

    setToken(accessToken);
    setUser(userData);
    setIsNewCustomer(!userData.isNewCustomer);
  };

  const effectiveUser = useMemo(() => {
    if (!user) return null;
    if (user.isSuperAdmin && inspectedCompany) {
      return {
        ...user,
        companyId: inspectedCompany.id,
      };
    }
    return user;
  }, [user, inspectedCompany]);

  const value = useMemo<AuthContextType>(
    () => ({
      user: effectiveUser,
      token,
      loading,
      isNewCustomer,
      inspectedCompany,
      setInspectedCompany,
      setIsNewCustomer,
      setUser,

      signInWithGoogleToken: async (idToken: string) => {
        try {
          const response = await axios.post(`${API_URL}/auth/google/token`, { token: idToken });
          const { accessToken, refreshToken, user: authUser } = response.data;

          const userObj: User = {
            id: authUser.sub,
            name: authUser.name,
            email: authUser.email,
            role: authUser.role || "Admin",
            userRole: authUser.userRole,
            avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(authUser.name)}`,
            provider: "google",
            isNewCustomer: authUser.onboarded,
            companyId: authUser.companyId,
          };

          await signIn(userObj, accessToken, refreshToken);
        } catch (error: any) {
          console.error("Google login failed", error);
          throw new Error("Google login failed");
        }
      },

      signInWithPassword: async (email: string, password: string) => {
        try {
          const response = await axios.post(`${API_URL}/auth/login`, { email, password });
          const { accessToken, refreshToken, user: authUser } = response.data;

          const userObj: User = {
            id: authUser.sub,
            name: authUser.name,
            email: authUser.email,
            role: authUser.role || "Admin",
            userRole: authUser.userRole,
            avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(authUser.name)}`,
            provider: "password",
            isNewCustomer: authUser.onboarded,
            companyId: authUser.companyId,
            isSuperAdmin: authUser.isSuperAdmin || false,
            companyAccess: authUser.companyAccess || null,
          };

          await signIn(userObj, accessToken, refreshToken);
        } catch (error: any) {
          const message =
            error.response?.data?.message ||
            error.message ||
            "Login failed. Please check your credentials and try again.";
          throw new Error(message);
        }
      },

      register: async (name: string, email: string, password: string) => {
        try {
          const response = await axios.post(`${API_URL}/auth/register`, { name, email, password });
          const { accessToken, refreshToken, user: authUser } = response.data;

          const userObj: User = {
            id: authUser.sub,
            name: authUser.name,
            email: authUser.email,
            role: authUser.role || "Admin",
            userRole: authUser.userRole,
            avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(authUser.name)}`,
            provider: "password",
            isNewCustomer: authUser.onboarded,
            companyId: authUser.companyId,
          };

          await signIn(userObj, accessToken, refreshToken);
        } catch (error: any) {
          console.error("Registration failed", error);
          throw new Error(error?.response?.data?.message || "Registration failed");
        }
      },

      signOut,
    }),
    [effectiveUser, token, loading, isNewCustomer, inspectedCompany, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

