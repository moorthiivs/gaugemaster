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
  signOut: () => Promise<void>;
  setIsNewCustomer: (value: boolean) => void;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
  validateSession: () => Promise<boolean>;
};

/** Decode JWT token payload safely */
export function parseJwt(token: string): any {
  try {
    const base64Url = token.split(".")[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      window
        .atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

/** Check if JWT is expired with safety buffer in seconds */
export function isTokenExpired(token: string | null, bufferSeconds: number = 15): boolean {
  if (!token) return true;
  const decoded = parseJwt(token);
  if (!decoded || !decoded.exp) return true;
  const currentTime = Math.floor(Date.now() / 1000);
  return decoded.exp <= currentTime + bufferSeconds;
}

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
    const currentToken = token || localStorage.getItem(TOKEN_KEY);
    try {
      if (currentToken) {
        await axios.post(
          `${API_URL}/auth/logout`,
          {},
          {
            headers: { Authorization: `Bearer ${currentToken}` },
          }
        );
      }
    } catch (err) {
      console.warn("Failed to notify backend on logout", err);
    }

    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(SETUP_KEY);
    localStorage.removeItem("setupData");
    localStorage.removeItem(INSPECTED_COMPANY_KEY);
    sessionStorage.clear();

    setToken(null);
    setUser(null);
    setInspectedCompanyState(null);
    setIsNewCustomer(false);
  }, [token]);

  // Validate session against backend /api/auth/me
  const validateSession = useCallback(async (): Promise<boolean> => {
    const currentToken = localStorage.getItem(TOKEN_KEY);
    if (!currentToken) return false;

    try {
      const response = await axios.get(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${currentToken}` },
      });
      const authUser = response.data;
      if (authUser) {
        const userObj: User = {
          id: authUser.sub || authUser.id,
          name: authUser.name,
          email: authUser.email,
          role: authUser.role || "Admin",
          userRole: authUser.userRole,
          avatarUrl: authUser.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(authUser.name)}`,
          provider: "password",
          isNewCustomer: !authUser.onboarded,
          companyId: authUser.companyId,
          isSuperAdmin: authUser.isSuperAdmin || false,
          companyAccess: authUser.companyAccess || null,
        };
        setUser(userObj);
        setIsNewCustomer(!authUser.onboarded);
        localStorage.setItem(USER_KEY, JSON.stringify(userObj));
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, []);

  // Initialize auth state on mount with automatic refresh if access token expired
  useEffect(() => {
    let isMounted = true;

    const initAuth = async () => {
      const storedToken = localStorage.getItem(TOKEN_KEY);
      const storedRefreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
      const storedUser = localStorage.getItem(USER_KEY);
      const setupCompleted = localStorage.getItem(SETUP_KEY);

      if (!storedToken && !storedRefreshToken) {
        if (isMounted) {
          setToken(null);
          setUser(null);
          setLoading(false);
        }
        return;
      }

      let parsedUser: User | null = null;
      if (storedUser) {
        try {
          parsedUser = JSON.parse(storedUser);
        } catch {
          parsedUser = null;
        }
      }

      let activeToken = storedToken;

      // If access token is missing or expired, but we have a refresh token, perform silent refresh
      if (isTokenExpired(storedToken) && storedRefreshToken) {
        if (isTokenExpired(storedRefreshToken)) {
          // Both access and refresh tokens are expired
          localStorage.removeItem(TOKEN_KEY);
          localStorage.removeItem(REFRESH_TOKEN_KEY);
          localStorage.removeItem(USER_KEY);
          localStorage.removeItem(SETUP_KEY);
          localStorage.removeItem(INSPECTED_COMPANY_KEY);
          activeToken = null;
          parsedUser = null;
        } else {
          try {
            const response = await axios.post(`${API_URL}/auth/refresh`, {
              refreshToken: storedRefreshToken,
            });
            const { accessToken: newAccessToken, refreshToken: newRefreshToken, user: authUser } = response.data;
            if (newAccessToken) {
              activeToken = newAccessToken;
              localStorage.setItem(TOKEN_KEY, newAccessToken);
              if (newRefreshToken) {
                localStorage.setItem(REFRESH_TOKEN_KEY, newRefreshToken);
              }
              if (authUser) {
                parsedUser = {
                  id: authUser.sub || authUser.id,
                  name: authUser.name,
                  email: authUser.email,
                  role: authUser.role || "Admin",
                  userRole: authUser.userRole,
                  avatarUrl: authUser.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(authUser.name)}`,
                  provider: "password",
                  isNewCustomer: !authUser.onboarded,
                  companyId: authUser.companyId,
                  isSuperAdmin: authUser.isSuperAdmin || false,
                  companyAccess: authUser.companyAccess || null,
                };
                localStorage.setItem(USER_KEY, JSON.stringify(parsedUser));
              }
            }
          } catch (err) {
            console.warn("Silent refresh failed on startup:", err);
            localStorage.removeItem(TOKEN_KEY);
            localStorage.removeItem(REFRESH_TOKEN_KEY);
            localStorage.removeItem(USER_KEY);
            localStorage.removeItem(SETUP_KEY);
            localStorage.removeItem(INSPECTED_COMPANY_KEY);
            activeToken = null;
            parsedUser = null;
          }
        }
      }

      if (isMounted) {
        if (activeToken && parsedUser) {
          setToken(activeToken);
          setUser(parsedUser);
          setIsNewCustomer(parsedUser.isNewCustomer && setupCompleted !== "true");
          validateSession().catch(() => {});
        } else {
          setToken(null);
          setUser(null);
          setIsNewCustomer(false);
        }
        setLoading(false);
      }
    };

    initAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  // Listen for custom token refresh, session expired, and cross-tab storage events
  useEffect(() => {
    const handleSessionExpiredEvent = () => {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(REFRESH_TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      localStorage.removeItem(SETUP_KEY);
      localStorage.removeItem("setupData");
      localStorage.removeItem(INSPECTED_COMPANY_KEY);
      sessionStorage.clear();
      setToken(null);
      setUser(null);
      setInspectedCompanyState(null);
      setIsNewCustomer(false);
    };

    const handleTokenRefreshedEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ token: string; user?: any }>;
      if (customEvent.detail?.token) {
        setToken(customEvent.detail.token);
      }
      if (customEvent.detail?.user) {
        const u = customEvent.detail.user;
        setUser((prev) => ({
          id: u.sub || u.id || prev?.id || "",
          name: u.name || prev?.name || "",
          email: u.email || prev?.email || "",
          role: u.role || prev?.role || "Admin",
          userRole: u.userRole || prev?.userRole,
          avatarUrl: u.avatarUrl || prev?.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(u.name || prev?.name || "User")}`,
          provider: prev?.provider || "password",
          isNewCustomer: u.onboarded !== undefined ? !u.onboarded : (prev?.isNewCustomer ?? false),
          companyId: u.companyId !== undefined ? u.companyId : (prev?.companyId || ""),
          isSuperAdmin: u.isSuperAdmin !== undefined ? u.isSuperAdmin : prev?.isSuperAdmin,
          companyAccess: u.companyAccess !== undefined ? u.companyAccess : prev?.companyAccess,
        }));
      }
    };

    // Cross-tab synchronization
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === TOKEN_KEY && !e.newValue) {
        handleSessionExpiredEvent();
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

    // Back-forward cache (bfcache) check
    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        const currentToken = localStorage.getItem(TOKEN_KEY);
        if (!currentToken) {
          handleSessionExpiredEvent();
        }
      }
    };

    window.addEventListener("auth:session-expired", handleSessionExpiredEvent);
    window.addEventListener("auth:token-refreshed", handleTokenRefreshedEvent);
    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("pageshow", handlePageShow);

    return () => {
      window.removeEventListener("auth:session-expired", handleSessionExpiredEvent);
      window.removeEventListener("auth:token-refreshed", handleTokenRefreshedEvent);
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, []);

  const signIn = async (userData: User, accessToken: string, refreshToken?: string) => {
    localStorage.setItem(TOKEN_KEY, accessToken);
    if (refreshToken) {
      localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    }
    localStorage.setItem(USER_KEY, JSON.stringify(userData));
    localStorage.setItem(SETUP_KEY, userData.isNewCustomer ? "false" : "true");

    setToken(accessToken);
    setUser(userData);
    setIsNewCustomer(userData.isNewCustomer);
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
      validateSession,

      signInWithGoogleToken: async (idToken: string) => {
        try {
          const response = await axios.post(`${API_URL}/auth/google/token`, { token: idToken });
          const { accessToken, refreshToken, user: authUser } = response.data;

          const userObj: User = {
            id: authUser.sub || authUser.id,
            name: authUser.name,
            email: authUser.email,
            role: authUser.role || "Admin",
            userRole: authUser.userRole,
            avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(authUser.name)}`,
            provider: "google",
            isNewCustomer: !authUser.onboarded,
            companyId: authUser.companyId,
            isSuperAdmin: authUser.isSuperAdmin || false,
            companyAccess: authUser.companyAccess || null,
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
            id: authUser.sub || authUser.id,
            name: authUser.name,
            email: authUser.email,
            role: authUser.role || "Admin",
            userRole: authUser.userRole,
            avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(authUser.name)}`,
            provider: "password",
            isNewCustomer: !authUser.onboarded,
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
            id: authUser.sub || authUser.id,
            name: authUser.name,
            email: authUser.email,
            role: authUser.role || "Admin",
            userRole: authUser.userRole,
            avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(authUser.name)}`,
            provider: "password",
            isNewCustomer: !authUser.onboarded,
            companyId: authUser.companyId,
            isSuperAdmin: authUser.isSuperAdmin || false,
            companyAccess: authUser.companyAccess || null,
          };

          await signIn(userObj, accessToken, refreshToken);
        } catch (error: any) {
          console.error("Registration failed", error);
          throw new Error(error?.response?.data?.message || "Registration failed");
        }
      },

      signOut,
    }),
    [effectiveUser, token, loading, isNewCustomer, inspectedCompany, signOut, validateSession]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
