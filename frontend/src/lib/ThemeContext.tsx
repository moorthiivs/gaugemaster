import React, { createContext, useContext, useEffect, useState } from "react";
import httpClient from "./httpClient";
import { useAuth } from "./auth";

export type ShadcnBaseColor =
  | "zinc"
  | "neutral"
  | "stone"
  | "slate"
  | "gray"
  | "mauve"
  | "olive"
  | "mist"
  | "taupe";

export type ShadcnThemeColor =
  | "zinc"
  | "slate"
  | "stone"
  | "blue"
  | "green"
  | "violet"
  | "rose"
  | "orange"
  | "yellow"
  | "mist"
  | "taupe";

export interface ShadcnBaseTokens {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  popover: string;
  popoverForeground: string;
  muted: string;
  mutedForeground: string;
  border: string;
  input: string;
  sidebarBackground: string;
  sidebarForeground: string;
  sidebarBorder: string;
  sidebarPrimary: string;
  sidebarPrimaryForeground: string;
  dotColor: string;
  defaultSidebarHex: string;
}

export const SHADCN_BASE_COLORS: Record<
  ShadcnBaseColor,
  {
    name: string;
    dotColor: string;
    light: ShadcnBaseTokens;
    dark: ShadcnBaseTokens;
  }
> = {
  zinc: {
    name: "Zinc",
    dotColor: "#71717a",
    light: {
      background: "0 0% 100%",
      foreground: "240 10% 3.9%",
      card: "0 0% 100%",
      cardForeground: "240 10% 3.9%",
      popover: "0 0% 100%",
      popoverForeground: "240 10% 3.9%",
      muted: "240 4.8% 95.9%",
      mutedForeground: "240 3.8% 46.1%",
      border: "240 5.9% 90%",
      input: "240 5.9% 90%",
      sidebarBackground: "0 0% 98%",
      sidebarForeground: "240 5.3% 26.1%",
      sidebarBorder: "240 5.9% 90%",
      sidebarPrimary: "240 5.9% 10%",
      sidebarPrimaryForeground: "0 0% 98%",
      dotColor: "#71717a",
      defaultSidebarHex: "#fafafa",
    },
    dark: {
      background: "240 10% 3.9%",
      foreground: "0 0% 98%",
      card: "240 10% 3.9%",
      cardForeground: "0 0% 98%",
      popover: "240 10% 3.9%",
      popoverForeground: "0 0% 98%",
      muted: "240 3.7% 15.9%",
      mutedForeground: "240 5% 64.9%",
      border: "240 3.7% 15.9%",
      input: "240 3.7% 15.9%",
      sidebarBackground: "240 5.9% 10%",
      sidebarForeground: "240 4.8% 95.9%",
      sidebarBorder: "240 3.7% 15.9%",
      sidebarPrimary: "0 0% 98%",
      sidebarPrimaryForeground: "240 5.9% 10%",
      dotColor: "#a1a1aa",
      defaultSidebarHex: "#18181b",
    },
  },
  neutral: {
    name: "Neutral",
    dotColor: "#737373",
    light: {
      background: "0 0% 100%",
      foreground: "0 0% 9%",
      card: "0 0% 100%",
      cardForeground: "0 0% 9%",
      popover: "0 0% 100%",
      popoverForeground: "0 0% 9%",
      muted: "0 0% 96.1%",
      mutedForeground: "0 0% 45.1%",
      border: "0 0% 89.8%",
      input: "0 0% 89.8%",
      sidebarBackground: "0 0% 98%",
      sidebarForeground: "0 0% 20%",
      sidebarBorder: "0 0% 89.8%",
      sidebarPrimary: "0 0% 9%",
      sidebarPrimaryForeground: "0 0% 98%",
      dotColor: "#737373",
      defaultSidebarHex: "#fafafa",
    },
    dark: {
      background: "0 0% 9%",
      foreground: "0 0% 98%",
      card: "0 0% 9%",
      cardForeground: "0 0% 98%",
      popover: "0 0% 9%",
      popoverForeground: "0 0% 98%",
      muted: "0 0% 14.9%",
      mutedForeground: "0 0% 63.9%",
      border: "0 0% 14.9%",
      input: "0 0% 14.9%",
      sidebarBackground: "0 0% 5%",
      sidebarForeground: "0 0% 98%",
      sidebarBorder: "0 0% 14.9%",
      sidebarPrimary: "0 0% 98%",
      sidebarPrimaryForeground: "0 0% 9%",
      dotColor: "#a3a3a3",
      defaultSidebarHex: "#0d0d0d",
    },
  },
  stone: {
    name: "Stone",
    dotColor: "#78716c",
    light: {
      background: "0 0% 100%",
      foreground: "24 9.8% 10%",
      card: "0 0% 100%",
      cardForeground: "24 9.8% 10%",
      popover: "0 0% 100%",
      popoverForeground: "24 9.8% 10%",
      muted: "60 4.8% 95.9%",
      mutedForeground: "25 5.3% 44.7%",
      border: "20 5.9% 90%",
      input: "20 5.9% 90%",
      sidebarBackground: "60 9.1% 97.8%",
      sidebarForeground: "24 9.8% 10%",
      sidebarBorder: "20 5.9% 90%",
      sidebarPrimary: "24 9.8% 10%",
      sidebarPrimaryForeground: "60 9.1% 97.8%",
      dotColor: "#78716c",
      defaultSidebarHex: "#fafaf9",
    },
    dark: {
      background: "24 9.8% 10%",
      foreground: "60 9.1% 97.8%",
      card: "24 9.8% 10%",
      cardForeground: "60 9.1% 97.8%",
      popover: "24 9.8% 10%",
      popoverForeground: "60 9.1% 97.8%",
      muted: "12 6.5% 15.1%",
      mutedForeground: "24 5.4% 63.9%",
      border: "12 6.5% 15.1%",
      input: "12 6.5% 15.1%",
      sidebarBackground: "20 14.3% 4.1%",
      sidebarForeground: "60 9.1% 97.8%",
      sidebarBorder: "12 6.5% 15.1%",
      sidebarPrimary: "60 9.1% 97.8%",
      sidebarPrimaryForeground: "24 9.8% 10%",
      dotColor: "#a8a29e",
      defaultSidebarHex: "#0c0a09",
    },
  },
  slate: {
    name: "Slate",
    dotColor: "#64748b",
    light: {
      background: "0 0% 100%",
      foreground: "222.2 84% 4.9%",
      card: "0 0% 100%",
      cardForeground: "222.2 84% 4.9%",
      popover: "0 0% 100%",
      popoverForeground: "222.2 84% 4.9%",
      muted: "210 40% 96.1%",
      mutedForeground: "215.4 16.3% 46.9%",
      border: "214.3 31.8% 91.4%",
      input: "214.3 31.8% 91.4%",
      sidebarBackground: "210 40% 98%",
      sidebarForeground: "222.2 84% 4.9%",
      sidebarBorder: "214.3 31.8% 91.4%",
      sidebarPrimary: "222.2 47.4% 11.2%",
      sidebarPrimaryForeground: "210 40% 98%",
      dotColor: "#64748b",
      defaultSidebarHex: "#f8fafc",
    },
    dark: {
      background: "222.2 84% 4.9%",
      foreground: "210 40% 98%",
      card: "222.2 84% 4.9%",
      cardForeground: "210 40% 98%",
      popover: "222.2 84% 4.9%",
      popoverForeground: "210 40% 98%",
      muted: "217.2 32.6% 17.5%",
      mutedForeground: "215 20.2% 65.1%",
      border: "217.2 32.6% 17.5%",
      input: "217.2 32.6% 17.5%",
      sidebarBackground: "222.2 47.4% 11.2%",
      sidebarForeground: "210 40% 98%",
      sidebarBorder: "217.2 32.6% 17.5%",
      sidebarPrimary: "210 40% 98%",
      sidebarPrimaryForeground: "222.2 47.4% 11.2%",
      dotColor: "#94a3b8",
      defaultSidebarHex: "#0f172a",
    },
  },
  gray: {
    name: "Gray",
    dotColor: "#6b7280",
    light: {
      background: "0 0% 100%",
      foreground: "220.9 39.3% 11%",
      card: "0 0% 100%",
      cardForeground: "220.9 39.3% 11%",
      popover: "0 0% 100%",
      popoverForeground: "220.9 39.3% 11%",
      muted: "220 14.3% 95.9%",
      mutedForeground: "220 8.9% 46.1%",
      border: "220 13% 91%",
      input: "220 13% 91%",
      sidebarBackground: "210 20% 98%",
      sidebarForeground: "220.9 39.3% 11%",
      sidebarBorder: "220 13% 91%",
      sidebarPrimary: "220.9 39.3% 11%",
      sidebarPrimaryForeground: "210 20% 98%",
      dotColor: "#6b7280",
      defaultSidebarHex: "#f9fafb",
    },
    dark: {
      background: "224 71.4% 4.1%",
      foreground: "210 20% 98%",
      card: "224 71.4% 4.1%",
      cardForeground: "210 20% 98%",
      popover: "224 71.4% 4.1%",
      popoverForeground: "210 20% 98%",
      muted: "215 27.9% 16.9%",
      mutedForeground: "217.9 10.6% 64.9%",
      border: "215 27.9% 16.9%",
      input: "215 27.9% 16.9%",
      sidebarBackground: "220 39% 9%",
      sidebarForeground: "210 20% 98%",
      sidebarBorder: "215 27.9% 16.9%",
      sidebarPrimary: "210 20% 98%",
      sidebarPrimaryForeground: "220 39% 9%",
      dotColor: "#9ca3af",
      defaultSidebarHex: "#111827",
    },
  },
  mauve: {
    name: "Mauve",
    dotColor: "#8b7e9c",
    light: {
      background: "0 0% 100%",
      foreground: "260 10% 10%",
      card: "0 0% 100%",
      cardForeground: "260 10% 10%",
      popover: "0 0% 100%",
      popoverForeground: "260 10% 10%",
      muted: "260 15% 95%",
      mutedForeground: "260 8% 48%",
      border: "260 12% 90%",
      input: "260 12% 90%",
      sidebarBackground: "260 20% 98%",
      sidebarForeground: "260 10% 10%",
      sidebarBorder: "260 12% 90%",
      sidebarPrimary: "260 10% 10%",
      sidebarPrimaryForeground: "260 20% 98%",
      dotColor: "#8b7e9c",
      defaultSidebarHex: "#f9f8fb",
    },
    dark: {
      background: "260 15% 6%",
      foreground: "260 20% 98%",
      card: "260 12% 11%",
      cardForeground: "260 20% 98%",
      popover: "260 12% 11%",
      popoverForeground: "260 20% 98%",
      muted: "260 10% 18%",
      mutedForeground: "260 8% 65%",
      border: "260 10% 20%",
      input: "260 10% 20%",
      sidebarBackground: "260 12% 9%",
      sidebarForeground: "260 20% 98%",
      sidebarBorder: "260 10% 20%",
      sidebarPrimary: "260 20% 98%",
      sidebarPrimaryForeground: "260 12% 9%",
      dotColor: "#a59fae",
      defaultSidebarHex: "#18151c",
    },
  },
  olive: {
    name: "Olive",
    dotColor: "#73786f",
    light: {
      background: "0 0% 100%",
      foreground: "90 10% 10%",
      card: "0 0% 100%",
      cardForeground: "90 10% 10%",
      popover: "0 0% 100%",
      popoverForeground: "90 10% 10%",
      muted: "90 12% 95%",
      mutedForeground: "90 8% 46%",
      border: "90 10% 89%",
      input: "90 10% 89%",
      sidebarBackground: "90 15% 98%",
      sidebarForeground: "90 10% 10%",
      sidebarBorder: "90 10% 89%",
      sidebarPrimary: "90 10% 10%",
      sidebarPrimaryForeground: "90 15% 98%",
      dotColor: "#73786f",
      defaultSidebarHex: "#f8faf6",
    },
    dark: {
      background: "90 12% 6%",
      foreground: "90 15% 98%",
      card: "90 10% 10%",
      cardForeground: "90 15% 98%",
      popover: "90 10% 10%",
      popoverForeground: "90 15% 98%",
      muted: "90 8% 18%",
      mutedForeground: "90 7% 64%",
      border: "90 8% 20%",
      input: "90 8% 20%",
      sidebarBackground: "90 10% 8%",
      sidebarForeground: "90 15% 98%",
      sidebarBorder: "90 8% 20%",
      sidebarPrimary: "90 15% 98%",
      sidebarPrimaryForeground: "90 10% 8%",
      dotColor: "#9ea499",
      defaultSidebarHex: "#141713",
    },
  },
  mist: {
    name: "Mist",
    dotColor: "#5e7a7e",
    light: {
      background: "0 0% 100%",
      foreground: "200 14.3% 4.1%",
      card: "0 0% 100%",
      cardForeground: "200 14.3% 4.1%",
      popover: "0 0% 100%",
      popoverForeground: "200 14.3% 4.1%",
      muted: "180 7.7% 94.9%",
      mutedForeground: "191.4 9.3% 44.5%",
      border: "192 9.8% 90%",
      input: "192 9.8% 90%",
      sidebarBackground: "180 20% 98%",
      sidebarForeground: "200 14.3% 4.1%",
      sidebarBorder: "192 9.8% 90%",
      sidebarPrimary: "160 100% 30%",
      sidebarPrimaryForeground: "151.8 81% 95.9%",
      dotColor: "#5e7a7e",
      defaultSidebarHex: "#f5faf8",
    },
    dark: {
      background: "200 14.3% 4.1%",
      foreground: "180 20% 98%",
      card: "197.1 13.7% 10%",
      cardForeground: "180 20% 98%",
      popover: "197.1 13.7% 10%",
      popoverForeground: "180 20% 98%",
      muted: "193.3 11.7% 15.1%",
      mutedForeground: "192 8.2% 64.1%",
      border: "193.3 11.7% 20%",
      input: "193.3 11.7% 22%",
      sidebarBackground: "197.1 13.7% 10%",
      sidebarForeground: "180 20% 98%",
      sidebarBorder: "193.3 11.7% 20%",
      sidebarPrimary: "159.9 100% 36.9%",
      sidebarPrimaryForeground: "166.4 100% 8.6%",
      dotColor: "#8fa8ac",
      defaultSidebarHex: "#161c1e",
    },
  },
  taupe: {
    name: "Taupe",
    dotColor: "#938274",
    light: {
      background: "0 0% 100%",
      foreground: "30 10% 10%",
      card: "0 0% 100%",
      cardForeground: "30 10% 10%",
      popover: "0 0% 100%",
      popoverForeground: "30 10% 10%",
      muted: "30 10% 94%",
      mutedForeground: "30 8% 46%",
      border: "30 10% 88%",
      input: "30 10% 88%",
      sidebarBackground: "30 15% 97%",
      sidebarForeground: "30 10% 10%",
      sidebarBorder: "30 10% 88%",
      sidebarPrimary: "30 25% 38%",
      sidebarPrimaryForeground: "0 0% 100%",
      dotColor: "#938274",
      defaultSidebarHex: "#faf6f2",
    },
    dark: {
      background: "30 10% 6%",
      foreground: "30 15% 97%",
      card: "30 10% 10%",
      cardForeground: "30 15% 97%",
      popover: "30 10% 10%",
      popoverForeground: "30 15% 97%",
      muted: "30 8% 18%",
      mutedForeground: "30 8% 64%",
      border: "30 8% 20%",
      input: "30 8% 20%",
      sidebarBackground: "30 10% 8%",
      sidebarForeground: "30 15% 97%",
      sidebarBorder: "30 8% 20%",
      sidebarPrimary: "30 28% 69%",
      sidebarPrimaryForeground: "30 10% 6%",
      dotColor: "#b2a396",
      defaultSidebarHex: "#161411",
    },
  },
};

export const SHADCN_THEME_COLORS: Record<
  ShadcnThemeColor,
  {
    name: string;
    dotColor: string;
    light: { primaryHsl: string; primaryForegroundHsl: string; hex: string };
    dark: { primaryHsl: string; primaryForegroundHsl: string; hex: string };
  }
> = {
  mist: {
    name: "Mist (Metrology)",
    dotColor: "#007a55",
    light: { primaryHsl: "161.8 100% 23.9%", primaryForegroundHsl: "151.8 81% 95.9%", hex: "#007a55" },
    dark: { primaryHsl: "161.8 100% 33%", primaryForegroundHsl: "151.8 81% 95.9%", hex: "#00a876" },
  },
  zinc: {
    name: "Zinc",
    dotColor: "#18181b",
    light: { primaryHsl: "240 5.9% 10%", primaryForegroundHsl: "0 0% 98%", hex: "#18181b" },
    dark: { primaryHsl: "0 0% 98%", primaryForegroundHsl: "240 5.9% 10%", hex: "#fafafa" },
  },
  slate: {
    name: "Slate",
    dotColor: "#0f172a",
    light: { primaryHsl: "222.2 47.4% 11.2%", primaryForegroundHsl: "210 40% 98%", hex: "#0f172a" },
    dark: { primaryHsl: "210 40% 98%", primaryForegroundHsl: "222.2 47.4% 11.2%", hex: "#f8fafc" },
  },
  stone: {
    name: "Stone",
    dotColor: "#1c1917",
    light: { primaryHsl: "24 9.8% 10%", primaryForegroundHsl: "60 9.1% 97.8%", hex: "#1c1917" },
    dark: { primaryHsl: "60 9.1% 97.8%", primaryForegroundHsl: "24 9.8% 10%", hex: "#fafaf9" },
  },
  blue: {
    name: "Blue",
    dotColor: "#2563eb",
    light: { primaryHsl: "221.2 83.2% 53.3%", primaryForegroundHsl: "210 40% 98%", hex: "#2563eb" },
    dark: { primaryHsl: "217.2 91.2% 59.8%", primaryForegroundHsl: "222.2 47.4% 11.2%", hex: "#3b82f6" },
  },
  green: {
    name: "Green",
    dotColor: "#16a34a",
    light: { primaryHsl: "142.1 76.2% 36.3%", primaryForegroundHsl: "355.7 100% 97.3%", hex: "#16a34a" },
    dark: { primaryHsl: "142.1 70.6% 45.3%", primaryForegroundHsl: "144 80% 10%", hex: "#22c55e" },
  },
  violet: {
    name: "Violet",
    dotColor: "#7c3aed",
    light: { primaryHsl: "262.1 83.3% 57.8%", primaryForegroundHsl: "210 40% 98%", hex: "#7c3aed" },
    dark: { primaryHsl: "258.3 89.5% 66.3%", primaryForegroundHsl: "210 40% 98%", hex: "#8b5cf6" },
  },
  rose: {
    name: "Rose",
    dotColor: "#e11d48",
    light: { primaryHsl: "346.8 77.2% 49.8%", primaryForegroundHsl: "355.7 100% 97.3%", hex: "#e11d48" },
    dark: { primaryHsl: "350 89% 60%", primaryForegroundHsl: "355.7 100% 97.3%", hex: "#f43f5e" },
  },
  orange: {
    name: "Orange",
    dotColor: "#ea580c",
    light: { primaryHsl: "24.6 95% 53.1%", primaryForegroundHsl: "60 9.1% 97.8%", hex: "#ea580c" },
    dark: { primaryHsl: "20.5 90.2% 48.2%", primaryForegroundHsl: "60 9.1% 97.8%", hex: "#f97316" },
  },
  yellow: {
    name: "Yellow",
    dotColor: "#d97706",
    light: { primaryHsl: "45 93% 47%", primaryForegroundHsl: "26 83.3% 14.1%", hex: "#d97706" },
    dark: { primaryHsl: "37.7 92.1% 50.2%", primaryForegroundHsl: "26 83.3% 14.1%", hex: "#f59e0b" },
  },
  taupe: {
    name: "Taupe",
    dotColor: "#786049",
    light: { primaryHsl: "30 25% 38%", primaryForegroundHsl: "0 0% 100%", hex: "#786049" },
    dark: { primaryHsl: "30 28% 69%", primaryForegroundHsl: "30 10% 6%", hex: "#c7b299" },
  },
};

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
  fontFamily?: "Geist" | "Inter" | "Plus Jakarta Sans" | "System";
  baseColor?: ShadcnBaseColor;
  themeColor?: ShadcnThemeColor;
  primaryColor?: string;
  sidebarColor?: string;
  accentColor?: string;
  isGlassmorphism?: boolean;
  lightTheme?: ThemeColorProfile;
  darkTheme?: ThemeColorProfile;
};

export const defaultLightTheme: ThemeColorProfile = {
  primaryColor: "#007a55",
  sidebarColor: "#f5faf8",
  accentColor: "#007a55",
  isGlassmorphism: false,
};

export const defaultDarkTheme: ThemeColorProfile = {
  primaryColor: "#00a876",
  sidebarColor: "#161c1e",
  accentColor: "#00a876",
  isGlassmorphism: true,
};

type ThemeContextType = {
  themeSettings: ThemeSettingsType;
  setThemeSettings: React.Dispatch<React.SetStateAction<ThemeSettingsType>>;
  saveTheme: (settings: ThemeSettingsType) => Promise<void>;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Helper to sanitize hex values (prevents double hashes like ##404040)
export const sanitizeHex = (val?: string): string => {
  if (!val) return "#000000";
  const clean = val.replace(/#/g, "").trim();
  return `#${clean}`;
};

// Helper to convert Hex to HSL format used by Tailwind
export const hexToHsl = (hex: string): string => {
  let cleanHex = hex.replace(/#/g, "").trim();
  if (cleanHex.length === 3) {
    cleanHex = cleanHex.split("").map((c) => c + c).join("");
  }
  if (cleanHex.length !== 6) {
    return "0 0% 50%";
  }
  const r = parseInt(cleanHex.slice(0, 2), 16) / 255;
  const g = parseInt(cleanHex.slice(2, 4), 16) / 255;
  const b = parseInt(cleanHex.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }
  return `${(h * 360).toFixed(1)} ${(s * 100).toFixed(1)}% ${(l * 100).toFixed(1)}%`;
};

// Helper to determine contrast text color
export const getContrastColor = (hex: string): string => {
  let cleanHex = hex.replace(/#/g, "").trim();
  if (cleanHex.length === 3) {
    cleanHex = cleanHex.split("").map((c) => c + c).join("");
  }
  if (cleanHex.length !== 6) {
    return "0 0% 98%";
  }
  const r = parseInt(cleanHex.slice(0, 2), 16);
  const g = parseInt(cleanHex.slice(2, 4), 16);
  const b = parseInt(cleanHex.slice(4, 6), 16);
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
    fontFamily: "Geist",
    baseColor: "mist",
    themeColor: "mist",
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
          // Default to Geist if unset or previously on old Plus Jakarta Sans default
          const activeFont = (!loaded.fontFamily || loaded.fontFamily === "Plus Jakarta Sans")
            ? "Geist"
            : loaded.fontFamily;

          setThemeSettings((prev) => ({
            ...prev,
            ...loaded,
            fontFamily: activeFont,
            baseColor: loaded.baseColor || prev.baseColor || "mist",
            themeColor: loaded.themeColor || prev.themeColor || "mist",
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

    // Apply Shadcn Base Color Palette
    const activeBaseKey = themeSettings.baseColor || "mist";
    const basePalette = SHADCN_BASE_COLORS[activeBaseKey] || SHADCN_BASE_COLORS.mist;
    const baseTokens = isDark ? basePalette.dark : basePalette.light;

    root.style.setProperty("--background", baseTokens.background);
    root.style.setProperty("--foreground", baseTokens.foreground);
    root.style.setProperty("--card", baseTokens.card);
    root.style.setProperty("--card-foreground", baseTokens.cardForeground);
    root.style.setProperty("--popover", baseTokens.popover);
    root.style.setProperty("--popover-foreground", baseTokens.popoverForeground);
    root.style.setProperty("--muted", baseTokens.muted);
    root.style.setProperty("--muted-foreground", baseTokens.mutedForeground);
    root.style.setProperty("--border", baseTokens.border);
    root.style.setProperty("--input", baseTokens.input);

    // Apply Shadcn Theme / Brand Palette
    const activeThemeKey = themeSettings.themeColor || "mist";
    const themePalette = SHADCN_THEME_COLORS[activeThemeKey] || SHADCN_THEME_COLORS.mist;
    const themeTokens = isDark ? themePalette.dark : themePalette.light;

    // Get active profile for dark vs light
    const activeProfile = isDark
      ? {
          ...defaultDarkTheme,
          ...themeSettings.darkTheme,
          primaryColor: themeSettings.darkTheme?.primaryColor || themeSettings.primaryColor,
          sidebarColor: themeSettings.darkTheme?.sidebarColor || themeSettings.sidebarColor,
          accentColor: themeSettings.darkTheme?.accentColor || themeSettings.accentColor,
          isGlassmorphism: themeSettings.darkTheme?.isGlassmorphism ?? themeSettings.isGlassmorphism ?? defaultDarkTheme.isGlassmorphism,
        }
      : {
          ...defaultLightTheme,
          ...themeSettings.lightTheme,
          primaryColor: themeSettings.lightTheme?.primaryColor || themeSettings.primaryColor,
          sidebarColor: themeSettings.lightTheme?.sidebarColor || themeSettings.sidebarColor,
          accentColor: themeSettings.lightTheme?.accentColor || themeSettings.accentColor,
          isGlassmorphism: themeSettings.lightTheme?.isGlassmorphism ?? defaultLightTheme.isGlassmorphism,
        };

    // Primary Theme Color: Use authentic shadcn theme tokens
    if (themeTokens) {
      root.style.setProperty("--primary", themeTokens.primaryHsl);
      root.style.setProperty("--brand", themeTokens.primaryHsl);
      root.style.setProperty("--primary-foreground", themeTokens.primaryForegroundHsl);
      root.style.setProperty("--ring", themeTokens.primaryHsl);
    } else if (activeProfile.primaryColor) {
      const cleanHex = sanitizeHex(activeProfile.primaryColor);
      const hsl = hexToHsl(cleanHex);
      root.style.setProperty("--primary", hsl);
      root.style.setProperty("--brand", hsl);
      root.style.setProperty("--primary-foreground", getContrastColor(cleanHex));
      root.style.setProperty("--ring", hsl);
    }

    // Sidebar Base: Use authentic shadcn base tokens
    root.style.setProperty("--sidebar-background", baseTokens.sidebarBackground);
    root.style.setProperty("--sidebar-foreground", baseTokens.sidebarForeground);
    root.style.setProperty("--sidebar-primary", baseTokens.sidebarPrimary);
    root.style.setProperty("--sidebar-primary-foreground", baseTokens.sidebarPrimaryForeground);
    root.style.setProperty("--sidebar-border", baseTokens.sidebarBorder);
    root.style.setProperty("--sidebar-accent", `${themeTokens.primaryHsl} / 0.12`);
    root.style.setProperty("--sidebar-accent-foreground", themeTokens.primaryHsl);

    // Accent & Surface
    root.style.setProperty("--accent", baseTokens.muted);
    root.style.setProperty("--accent-foreground", baseTokens.foreground);

    // Font Family: Standardized to Geist & Geist Mono (shadcn design system)
    const activeFont = themeSettings.fontFamily || "Geist";
    let fontStack = "";
    if (activeFont === "Inter") {
      fontStack = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    } else if (activeFont === "System") {
      fontStack = "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
    } else {
      // Default & Standard: Geist (shadcn)
      fontStack = "'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
    }
    const monoStack = "'Geist Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace";
    root.style.setProperty("--font-sans", fontStack);
    root.style.setProperty("--font-mono", monoStack);
    document.body.style.fontFamily = fontStack;

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
    root.classList.toggle("glass-enabled", (themeSettings.isGlassmorphism ?? activeProfile.isGlassmorphism) ?? false);

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
