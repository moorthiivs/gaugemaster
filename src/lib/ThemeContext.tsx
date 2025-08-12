import React, { createContext, useContext, useEffect, useState } from "react";

type ThemeSettingsType = {
    colorScheme: "dark" | "light" | "auto";
    fontSize: "small" | "medium" | "large" | "extra-large";
    compactMode: boolean;
    animations: boolean;
    highContrast: boolean;
    reducedMotion: boolean;
};

type ThemeContextType = {
    themeSettings: ThemeSettingsType;
    setThemeSettings: React.Dispatch<React.SetStateAction<ThemeSettingsType>>;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
    const [themeSettings, setThemeSettings] = useState<ThemeSettingsType>({
        colorScheme: "dark",
        fontSize: "medium",
        compactMode: false,
        animations: true,
        highContrast: false,
        reducedMotion: false,
    });

    // Apply settings to document root
    useEffect(() => {
        // Theme
        if (themeSettings.colorScheme === "auto") {
            const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
            document.documentElement.setAttribute("data-theme", systemDark ? "dark" : "light");
        } else {
            document.documentElement.setAttribute("data-theme", themeSettings.colorScheme);
        }

        // Font size
        document.documentElement.style.fontSize =
            themeSettings.fontSize === "small" ? "14px" :
                themeSettings.fontSize === "medium" ? "16px" :
                    themeSettings.fontSize === "large" ? "18px" :
                        "20px";

        // Compact Mode
        document.documentElement.classList.toggle("compact-mode", themeSettings.compactMode);

        // High Contrast
        document.documentElement.classList.toggle("high-contrast", themeSettings.highContrast);

        // Reduced Motion
        if (themeSettings.reducedMotion) {
            document.documentElement.style.setProperty("--animation-duration", "0s");
        } else {
            document.documentElement.style.removeProperty("--animation-duration");
        }

    }, [themeSettings]);

    return (
        <ThemeContext.Provider value={{ themeSettings, setThemeSettings }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useThemeSettings = () => {
    const context = useContext(ThemeContext);
    if (!context) throw new Error("useThemeSettings must be used inside ThemeProvider");
    return context;
};
