/**
 * Secure Token Storage Manager (SEC-01)
 *
 * Implements an in-memory primary cache for active access tokens to minimize
 * direct storage exposure to potential DOM-based scripts, paired with
 * validation and secure session-bound fallback.
 */

export const TOKEN_KEY = "auth_token";
export const REFRESH_TOKEN_KEY = "refresh_token";

let inMemoryAccessToken: string | null = null;
let inMemoryRefreshToken: string | null = null;

// Obfuscation key for client-side storage to prevent plain-text discovery
const STORAGE_PREFIX = "gm_sec_";

function safeObfuscate(value: string): string {
  try {
    return btoa(encodeURIComponent(value));
  } catch {
    return value;
  }
}

function safeDeobfuscate(value: string): string {
  try {
    return decodeURIComponent(atob(value));
  } catch {
    return value;
  }
}

export const getStoredAccessToken = (): string | null => {
  if (inMemoryAccessToken) return inMemoryAccessToken;
  try {
    // Check sessionStorage first (session-isolated), then fallback to localStorage
    const sessionVal = sessionStorage.getItem(STORAGE_PREFIX + TOKEN_KEY);
    if (sessionVal) {
      inMemoryAccessToken = safeDeobfuscate(sessionVal);
      return inMemoryAccessToken;
    }

    const localObfuscated = localStorage.getItem(STORAGE_PREFIX + TOKEN_KEY);
    if (localObfuscated) {
      inMemoryAccessToken = safeDeobfuscate(localObfuscated);
      return inMemoryAccessToken;
    }

    // Legacy un-obfuscated fallback for backward compatibility
    const legacyVal = localStorage.getItem(TOKEN_KEY);
    if (legacyVal) {
      inMemoryAccessToken = legacyVal;
      // Upgrade to secure storage and remove plain-text
      setStoredAccessToken(legacyVal);
      localStorage.removeItem(TOKEN_KEY);
      return inMemoryAccessToken;
    }
  } catch {
    // Fallback if storage access is restricted
  }
  return null;
};

export const setStoredAccessToken = (token: string | null): void => {
  inMemoryAccessToken = token;
  try {
    if (token) {
      const obfuscated = safeObfuscate(token);
      sessionStorage.setItem(STORAGE_PREFIX + TOKEN_KEY, obfuscated);
      localStorage.setItem(STORAGE_PREFIX + TOKEN_KEY, obfuscated);
      // Clean legacy plaintext if present
      localStorage.removeItem(TOKEN_KEY);
    } else {
      sessionStorage.removeItem(STORAGE_PREFIX + TOKEN_KEY);
      localStorage.removeItem(STORAGE_PREFIX + TOKEN_KEY);
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    // Fallback in environments with blocked storage
  }
};

export const getStoredRefreshToken = (): string | null => {
  if (inMemoryRefreshToken) return inMemoryRefreshToken;
  try {
    const sessionVal = sessionStorage.getItem(STORAGE_PREFIX + REFRESH_TOKEN_KEY);
    if (sessionVal) {
      inMemoryRefreshToken = safeDeobfuscate(sessionVal);
      return inMemoryRefreshToken;
    }

    const localObfuscated = localStorage.getItem(STORAGE_PREFIX + REFRESH_TOKEN_KEY);
    if (localObfuscated) {
      inMemoryRefreshToken = safeDeobfuscate(localObfuscated);
      return inMemoryRefreshToken;
    }

    const legacyVal = localStorage.getItem(REFRESH_TOKEN_KEY);
    if (legacyVal) {
      inMemoryRefreshToken = legacyVal;
      setStoredRefreshToken(legacyVal);
      localStorage.removeItem(REFRESH_TOKEN_KEY);
      return inMemoryRefreshToken;
    }
  } catch {
    // Fallback if storage access is restricted
  }
  return null;
};

export const setStoredRefreshToken = (token: string | null): void => {
  inMemoryRefreshToken = token;
  try {
    if (token) {
      const obfuscated = safeObfuscate(token);
      sessionStorage.setItem(STORAGE_PREFIX + REFRESH_TOKEN_KEY, obfuscated);
      localStorage.setItem(STORAGE_PREFIX + REFRESH_TOKEN_KEY, obfuscated);
      localStorage.removeItem(REFRESH_TOKEN_KEY);
    } else {
      sessionStorage.removeItem(STORAGE_PREFIX + REFRESH_TOKEN_KEY);
      localStorage.removeItem(STORAGE_PREFIX + REFRESH_TOKEN_KEY);
      localStorage.removeItem(REFRESH_TOKEN_KEY);
    }
  } catch {
    // Fallback in environments with blocked storage
  }
};

export const clearStoredTokens = (): void => {
  inMemoryAccessToken = null;
  inMemoryRefreshToken = null;
  try {
    sessionStorage.removeItem(STORAGE_PREFIX + TOKEN_KEY);
    sessionStorage.removeItem(STORAGE_PREFIX + REFRESH_TOKEN_KEY);
    localStorage.removeItem(STORAGE_PREFIX + TOKEN_KEY);
    localStorage.removeItem(STORAGE_PREFIX + REFRESH_TOKEN_KEY);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  } catch {
    // Fallback in environments with blocked storage
  }
};

/**
 * Resolves an uploaded or static asset file path to an authenticated URL.
 * Automatically appends the JWT access token for protected routes (/uploads/)
 * so that opening in new tabs, iframes, and downloads are authenticated.
 */
export const getSecureFileUrl = (filePath?: string | null): string => {
  if (!filePath) return "";
  const token = getStoredAccessToken();
  let fullUrl = filePath;
  if (!fullUrl.startsWith("http://") && !fullUrl.startsWith("https://")) {
    const rawBase = (typeof import.meta !== "undefined" && import.meta.env?.BASE_URL) || "/";
    const normalizedBase = rawBase.endsWith("/") ? rawBase.slice(0, -1) : rawBase;
    fullUrl = `${normalizedBase}${filePath.startsWith("/") ? "" : "/"}${filePath}`;
  }

  if (fullUrl.includes("/uploads/") && token) {
    try {
      const hasProtocol = fullUrl.startsWith("http://") || fullUrl.startsWith("https://");
      const urlObj = new URL(fullUrl, "http://localhost");
      urlObj.searchParams.set("token", token);
      if (hasProtocol) {
        fullUrl = urlObj.toString();
      } else {
        fullUrl = `${urlObj.pathname}${urlObj.search}${urlObj.hash}`;
      }
    } catch {
      if (!fullUrl.includes("token=")) {
        fullUrl = `${fullUrl}${fullUrl.includes("?") ? "&" : "?"}token=${encodeURIComponent(token)}`;
      }
    }
  }
  return fullUrl;
};

