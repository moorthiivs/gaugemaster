import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";

export const API_URL = import.meta.env.VITE_API_URL || "/api";

export const TOKEN_KEY = "auth_token";
export const REFRESH_TOKEN_KEY = "refresh_token";
export const USER_KEY = "auth_user";
export const SETUP_KEY = "setupCompleted";
export const INSPECTED_COMPANY_KEY = "inspected_company";

const httpClient = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

// Request queue to hold requests while a token refresh is in progress
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: any) => void;
  reject: (reason?: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

/** Clear all local auth state and broadcast session expired event */
export const handleSessionExpired = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(SETUP_KEY);
  localStorage.removeItem(INSPECTED_COMPANY_KEY);
  localStorage.removeItem("setupData");

  // Broadcast session expired event for React components (AuthProvider)
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("auth:session-expired"));

    // If not already on login or public landing page, redirect to login
    const currentPath = window.location.pathname;
    if (currentPath !== "/login" && currentPath !== "/" && currentPath !== "/register") {
      window.location.href = `/login?session_expired=true&redirect=${encodeURIComponent(currentPath)}`;
    }
  }
};

// Request interceptor to attach bearer token
httpClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to catch 401 errors, silently refresh token, and retry requests
httpClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // If there's no response or the error is not 401, reject immediately
    if (!error.response || error.response.status !== 401) {
      return Promise.reject(error);
    }

    // Do not attempt refresh on auth endpoints (login, register, refresh) to prevent infinite loops
    const requestUrl = originalRequest.url || "";
    if (
      requestUrl.includes("/auth/login") ||
      requestUrl.includes("/auth/register") ||
      requestUrl.includes("/auth/refresh") ||
      requestUrl.includes("/auth/google")
    ) {
      return Promise.reject(error);
    }

    // If the request was already retried once, don't retry again
    if (originalRequest._retry) {
      handleSessionExpired();
      return Promise.reject(error);
    }

    // If a refresh is already underway, queue this request
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      })
        .then((newToken) => {
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
          }
          return httpClient(originalRequest);
        })
        .catch((err) => Promise.reject(err));
    }

    originalRequest._retry = true;
    isRefreshing = true;

    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);

    if (!refreshToken) {
      isRefreshing = false;
      handleSessionExpired();
      return Promise.reject(error);
    }

    try {
      // Use raw axios to prevent interceptor loop
      const response = await axios.post(`${API_URL}/auth/refresh`, {
        refreshToken,
      });

      const { accessToken: newAccessToken, refreshToken: newRefreshToken, user: updatedUser } = response.data;

      if (!newAccessToken) {
        throw new Error("No access token returned from refresh endpoint");
      }

      // Store refreshed tokens
      localStorage.setItem(TOKEN_KEY, newAccessToken);
      if (newRefreshToken) {
        localStorage.setItem(REFRESH_TOKEN_KEY, newRefreshToken);
      }
      if (updatedUser) {
        localStorage.setItem(USER_KEY, JSON.stringify(updatedUser));
      }

      // Notify auth context of updated tokens
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("auth:token-refreshed", {
            detail: { token: newAccessToken, user: updatedUser },
          })
        );
      }

      // Process queued requests with the new token
      processQueue(null, newAccessToken);

      // Retry original request
      if (originalRequest.headers) {
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
      }
      return httpClient(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError, null);
      handleSessionExpired();
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

export default httpClient;

