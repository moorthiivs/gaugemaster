import React, { createContext, useContext, useEffect, useState } from "react";
import httpClient from "./httpClient";
import { useAuth } from "./auth";

export type ThemeColorProfile = {
  primaryColor: string;
  sidebarColor: string;
  accentColor: string;
  isGlassmorphism: boolean;
};

export type ThemeSettingsType = {
  colorScheme: "dark" | "light" | "auto";
  fontSize: "small" | "medium" | "large" | "extra-large";
  compactMode: boolean;
  animations: boolean;
  highContrast: boolean;
  reducedMotion: boolean;
  fontFamily?: "Inter" | "Plus Jakarta Sans" | "System";
  primaryColor?: string;
  sidebarColor?: string;
  accentColor?: string;
  isGlassmorphism?: boolean;
  lightTheme?: ThemeColorProfile;
  darkTheme?: ThemeColorProfile;
};

export const defaultLightTheme: ThemeColorProfile = {
  primaryColor: "#2563eb",
  sidebarColor: "#ffffff",
  accentColor: "#2563eb",
  isGlassmorphism: false,
};

export const defaultDarkTheme: ThemeColorProfile = {
  primaryColor: "#3b82f6",
  sidebarColor: "#0f172a",
  accentColor: "#3b82f6",
  isGlassmorphism: true,
};

type ThemeContextType = {
  themeSettings: ThemeSettingsType;
  setThemeSettings: React.Dispatch<React.SetStateAction<ThemeSettingsType>>;
  saveTheme: (settings: ThemeSettingsType) => Promise<void>;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Helper to convert Hex to HSL format used by Tailwind
const hexToHsl = (hex: string): string => {
  let r = 0, g = 0, b = 0;
  if (hex.length === 4) {
    r = parseInt(hex[1] + hex[1], 16);
    g = parseInt(hex[2] + hex[2], 16);
    b = parseInt(hex[3] + hex[3], 16);
  } else if (hex.length === 7) {
    r = parseInt(hex.slice(1, 3), 16);
    g = parseInt(hex.slice(3, 5), 16);
    b = parseInt(hex.slice(5, 7), 16);
  }
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return `${(h * 360).toFixed(1)} ${(s * 100).toFixed(1)}% ${(l * 100).toFixed(1)}%`;
};

// Helper to determine contrast text color
const getContrastColor = (hex: string): string => {
  let r = 0, g = 0, b = 0;
  if (hex.length === 4) {
    r = parseInt(hex[1] + hex[1], 16);
    g = parseInt(hex[2] + hex[2], 16);
    b = parseInt(hex[3] + hex[3], 16);
  } else if (hex.length === 7) {
    r = parseInt(hex.slice(1, 3), 16);
    g = parseInt(hex.slice(3, 5), 16);
    b = parseInt(hex.slice(5, 7), 16);
  }
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 155 ? "240 5.9% 10%" : "0 0% 98%";
};

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const [themeSettings, setThemeSettings] = useState<ThemeSettingsType>({
    colorScheme: "dark",
    fontSize: "medium",
    compactMode: false,
    animations: true,
    highContrast: false,
    reducedMotion: false,
    fontFamily: "Inter",
    lightTheme: defaultLightTheme,
    darkTheme: defaultDarkTheme,
  });

  // Load from DB
  useEffect(() => {
    const fetchSettings = async () => {
      if (!user?.id || !user?.companyId) return;
      try {
        const res = await httpClient.get(`/settings/${user.id}/${user.companyId}`);
        if (res.data?.themeSettings) {
          const loaded = res.data.themeSettings;
          setThemeSettings(prev => ({
            ...prev,
            ...loaded,
            lightTheme: { ...defaultLightTheme, ...(loaded.lightTheme || {}) },
            darkTheme: { ...defaultDarkTheme, ...(loaded.darkTheme || {}) },
          }));
        }
      } catch (err) {
        console.error("Failed to fetch theme settings", err);
      }
    };
    fetchSettings();
  }, [user?.id, user?.companyId]);

  const saveTheme = async (settings: ThemeSettingsType) => {
    if (!user?.id || !user?.companyId) return;
    try {
      await httpClient.post("/settings", {
        userId: user.id,
        companyId: user.companyId,
        themeSettings: settings,
      });
      setThemeSettings(settings);
    } catch (err) {
      console.error("Failed to save theme settings", err);
    }
  };

  // Apply settings to document root dynamically
  useEffect(() => {
    const root = document.documentElement;

    // Theme Mode
    let isDark = false;
    if (themeSettings.colorScheme === "auto") {
      isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    } else {
      isDark = themeSettings.colorScheme === "dark";
    }

    root.setAttribute("data-theme", isDark ? "dark" : "light");
    root.classList.toggle("dark", isDark);

    // Get active profile for dark vs light
    const activeProfile = isDark
      ? {
          ...defaultDarkTheme,
          ...themeSettings.darkTheme,
          primaryColor: themeSettings.darkTheme?.primaryColor || themeSettings.primaryColor || defaultDarkTheme.primaryColor,
          sidebarColor: themeSettings.darkTheme?.sidebarColor || themeSettings.sidebarColor || defaultDarkTheme.sidebarColor,
          accentColor: themeSettings.darkTheme?.accentColor || themeSettings.accentColor || defaultDarkTheme.accentColor,
          isGlassmorphism: themeSettings.darkTheme?.isGlassmorphism ?? themeSettings.isGlassmorphism ?? defaultDarkTheme.isGlassmorphism,
        }
      : {
          ...defaultLightTheme,
          ...themeSettings.lightTheme,
          primaryColor: themeSettings.lightTheme?.primaryColor || defaultLightTheme.primaryColor,
          sidebarColor: themeSettings.lightTheme?.sidebarColor || defaultLightTheme.sidebarColor,
          accentColor: themeSettings.lightTheme?.accentColor || defaultLightTheme.accentColor,
          isGlassmorphism: themeSettings.lightTheme?.isGlassmorphism ?? defaultLightTheme.isGlassmorphism,
        };

    // Primary Theme Color
    if (activeProfile.primaryColor) {
      const hsl = hexToHsl(activeProfile.primaryColor);
      root.style.setProperty("--primary", hsl);
    }

    // Sidebar Base
    if (activeProfile.sidebarColor) {
      const hsl = hexToHsl(activeProfile.sidebarColor);
      const contrast = getContrastColor(activeProfile.sidebarColor);
      root.style.setProperty("--sidebar-background", hsl);
      root.style.setProperty("--sidebar-foreground", contrast);
      root.style.setProperty("--sidebar-primary", contrast);
      root.style.setProperty("--sidebar-border", isDark ? "240 3.7% 15.9%" : "220 13% 91%");
    }

    // Accent & Highlight
    if (activeProfile.accentColor) {
      const hsl = hexToHsl(activeProfile.accentColor);
      root.style.setProperty("--accent", hsl);
      root.style.setProperty("--ring", hsl);
      root.style.setProperty("--brand", hsl);
      root.style.setProperty("--sidebar-accent", `${hsl} / 0.15`);
      root.style.setProperty("--sidebar-accent-foreground", hsl);
    }

    // Font Family
    if (themeSettings.fontFamily) {
      let fontStack = "";
      if (themeSettings.fontFamily === "Inter") fontStack = "'Inter', ui-sans-serif, system-ui, sans-serif";
      else if (themeSettings.fontFamily === "Plus Jakarta Sans") fontStack = "'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif";
      else fontStack = "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
      root.style.setProperty("--font-sans", fontStack);
    }

    // Font Scaling
    root.style.fontSize =
      themeSettings.fontSize === "small"
        ? "14px"
        : themeSettings.fontSize === "medium"
        ? "16px"
        : themeSettings.fontSize === "large"
        ? "18px"
        : "20px";

    // Compact Mode & High Contrast
    root.classList.toggle("compact-mode", themeSettings.compactMode);
    root.classList.toggle("high-contrast", themeSettings.highContrast);

    // Glassmorphism Effect
    root.classList.toggle("glass-enabled", activeProfile.isGlassmorphism ?? false);

    // Reduced Motion
    if (themeSettings.reducedMotion) {
      root.style.setProperty("--animation-duration", "0s");
    } else {
      root.style.removeProperty("--animation-duration");
    }
  }, [themeSettings]);

  return (
    <ThemeContext.Provider value={{ themeSettings, setThemeSettings, saveTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useThemeSettings = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useThemeSettings must be used inside ThemeProvider");
  return context;
};
