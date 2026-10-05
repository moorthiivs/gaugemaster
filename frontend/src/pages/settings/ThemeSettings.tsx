import React from "react";
import {
  useThemeSettings,
  defaultDarkTheme,
  defaultLightTheme,
  SHADCN_BASE_COLORS,
  SHADCN_THEME_COLORS,
  ShadcnBaseColor,
  ShadcnThemeColor,
} from "@/lib/ThemeContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Palette, Monitor, Smartphone, Globe, Shuffle, Layers } from "lucide-react";

export default function ThemeSettings() {
  const { toast } = useToast();
  const { themeSettings, setThemeSettings, saveTheme } = useThemeSettings();

  const handleSave = async () => {
    try {
      await saveTheme(themeSettings);
      toast({
        title: "Appearance Saved to Database",
        description: "Your theme preferences have been saved to your account.",
      });
    } catch {
      toast({
        title: "Save Failed",
        description: "There was an error saving your theme preferences to database.",
        variant: "destructive",
      });
    }
  };

  const currentBaseColor: ShadcnBaseColor = themeSettings.baseColor || "mist";
  const currentThemeColor: ShadcnThemeColor = themeSettings.themeColor || "mist";

  const handleBaseColorChange = (baseColor: ShadcnBaseColor) => {
    const basePalette = SHADCN_BASE_COLORS[baseColor];
    if (!basePalette) return;

    setThemeSettings((prev) => {
      const isDark =
        prev.colorScheme === "dark" ||
        (prev.colorScheme === "auto" && window.matchMedia("(prefers-color-scheme: dark)").matches);
      const newSidebarHex = isDark ? basePalette.dark.defaultSidebarHex : basePalette.light.defaultSidebarHex;

      return {
        ...prev,
        baseColor,
        lightTheme: {
          ...defaultLightTheme,
          ...(prev.lightTheme || {}),
          sidebarColor: basePalette.light.defaultSidebarHex,
        },
        darkTheme: {
          ...defaultDarkTheme,
          ...(prev.darkTheme || {}),
          sidebarColor: basePalette.dark.defaultSidebarHex,
        },
        sidebarColor: newSidebarHex,
      };
    });
  };

  const handleThemeColorChange = (themeColor: ShadcnThemeColor) => {
    const themePalette = SHADCN_THEME_COLORS[themeColor];
    if (!themePalette) return;

    setThemeSettings((prev) => {
      const isDark =
        prev.colorScheme === "dark" ||
        (prev.colorScheme === "auto" && window.matchMedia("(prefers-color-scheme: dark)").matches);
      const newPrimaryHex = isDark ? themePalette.dark.hex : themePalette.light.hex;

      return {
        ...prev,
        themeColor,
        lightTheme: {
          ...defaultLightTheme,
          ...(prev.lightTheme || {}),
          primaryColor: themePalette.light.hex,
          accentColor: themePalette.light.hex,
        },
        darkTheme: {
          ...defaultDarkTheme,
          ...(prev.darkTheme || {}),
          primaryColor: themePalette.dark.hex,
          accentColor: themePalette.dark.hex,
        },
        primaryColor: newPrimaryHex,
        accentColor: newPrimaryHex,
      };
    });
  };

  const applyPreset = (presetName: string) => {
    if (presetName === "mist") {
      handleBaseColorChange("mist");
      handleThemeColorChange("mist");
      toast({
        title: "Preset Applied: Mist & Emerald",
        description: "Applied shadcn modern Metrology preset (--preset b7BFbw9eC).",
      });
    } else if (presetName === "zinc") {
      handleBaseColorChange("zinc");
      handleThemeColorChange("zinc");
      toast({
        title: "Preset Applied: Zinc Monochrome",
        description: "Applied standard shadcn default Zinc palette.",
      });
    } else if (presetName === "taupe") {
      handleBaseColorChange("taupe");
      handleThemeColorChange("taupe");
      toast({
        title: "Preset Applied: Taupe",
        description: "Applied warm modern Taupe palette.",
      });
    } else if (presetName === "slate") {
      handleBaseColorChange("slate");
      handleThemeColorChange("blue");
      toast({
        title: "Preset Applied: Slate & Royal Blue",
        description: "Applied modern cool Slate & Blue palette.",
      });
    }
  };

  const handleShuffle = () => {
    const baseKeys = Object.keys(SHADCN_BASE_COLORS) as ShadcnBaseColor[];
    const themeKeys = Object.keys(SHADCN_THEME_COLORS) as ShadcnThemeColor[];
    const randomBase = baseKeys[Math.floor(Math.random() * baseKeys.length)];
    const randomTheme = themeKeys[Math.floor(Math.random() * themeKeys.length)];
    handleBaseColorChange(randomBase);
    handleThemeColorChange(randomTheme);
    toast({
      title: `Shuffled: ${SHADCN_BASE_COLORS[randomBase].name} + ${SHADCN_THEME_COLORS[randomTheme].name}`,
      description: "Previewing new random aesthetic combination.",
    });
  };

  const handleSettingChange = (field: keyof typeof themeSettings, value: any) => {
    setThemeSettings((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const colorSchemes = [
    { value: "dark", label: "Dark Mode", description: "Deep blacks and vibrant accents" },
    { value: "light", label: "Light Mode", description: "Crisp whites and soft shadows" },
    { value: "auto", label: "System", description: "Matches your OS preference" },
  ];

  const fontSizes = [
    { value: "small", label: "Small" },
    { value: "medium", label: "Medium" },
    { value: "large", label: "Large" },
    { value: "extra-large", label: "Extra Large" },
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-primary/10 rounded-2xl shadow-inner">
            <Palette className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Appearance</h2>
            <p className="text-muted-foreground">
              Personalize your workspace with authentic shadcn Base Colors, Theme accents, and typography.
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => window.location.reload()}>
            Reset Changes
          </Button>
          <Button onClick={handleSave} className="shadow-lg shadow-primary/20 px-8 font-bold">
            Save Changes
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Color Scheme Picker */}
        <Card className="bg-card/40 backdrop-blur-md border-primary/10 shadow-xl overflow-hidden">
          <CardHeader className="pb-4 border-b border-primary/5 bg-primary/5">
            <div className="flex items-center gap-2">
              <Monitor className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Color Scheme</CardTitle>
            </div>
            <CardDescription>Choose the overall brightness of the system.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid gap-3">
              {colorSchemes.map((scheme) => (
                <div
                  key={scheme.value}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all duration-300 group ${
                    themeSettings.colorScheme === scheme.value
                      ? "border-primary bg-primary/10 shadow-inner"
                      : "border-transparent bg-muted/30 hover:bg-muted/50"
                  }`}
                  onClick={() => handleSettingChange("colorScheme", scheme.value)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="font-semibold text-base">{scheme.label}</span>
                      <span className="text-xs text-muted-foreground mt-0.5">{scheme.description}</span>
                    </div>
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        themeSettings.colorScheme === scheme.value
                          ? "border-primary bg-primary"
                          : "border-muted-foreground/30"
                      }`}
                    >
                      {themeSettings.colorScheme === scheme.value && (
                        <div className="w-2 h-2 rounded-full bg-white" />
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Shadcn Theme Selector (Matches Screenshot 2 Format) */}
        <Card className="bg-card/40 backdrop-blur-md border-primary/10 shadow-xl">
          <CardHeader className="pb-4 border-b border-primary/5 bg-primary/5 flex flex-row items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Layers className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Theme Selector</CardTitle>
              </div>
              <CardDescription>
                Select authentic shadcn base palettes and accent themes with live preview.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-5">
            {/* Base Color Dropdown (Screenshot 2: Base Color -> Neutral, Stone, Zinc, Mauve, Olive, Mist, Taupe) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  BASE COLOR
                </Label>
                <span className="text-xs text-muted-foreground font-medium">
                  Neutral background & surface tones
                </span>
              </div>
              <Select
                value={currentBaseColor}
                onValueChange={(val) => handleBaseColorChange(val as ShadcnBaseColor)}
              >
                <SelectTrigger className="bg-background/60 h-11 border-border/80">
                  <div className="flex items-center justify-between w-full pr-2">
                    <span className="font-medium text-sm">
                      {SHADCN_BASE_COLORS[currentBaseColor]?.name || "Mist"}
                    </span>
                    <span
                      className="w-3.5 h-3.5 rounded-full border border-border shrink-0 shadow-2xs"
                      style={{
                        backgroundColor: SHADCN_BASE_COLORS[currentBaseColor]?.dotColor || "#5e7a7e",
                      }}
                    />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(SHADCN_BASE_COLORS) as ShadcnBaseColor[]).map((key) => {
                    const item = SHADCN_BASE_COLORS[key];
                    return (
                      <SelectItem key={key} value={key}>
                        <div className="flex items-center justify-between gap-4 w-full min-w-[200px]">
                          <span>{item.name}</span>
                          <span
                            className="w-3.5 h-3.5 rounded-full border border-border shadow-2xs shrink-0"
                            style={{ backgroundColor: item.dotColor }}
                          />
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Theme Dropdown (Screenshot 2: Theme -> Taupe, Zinc, Slate, Stone, Blue, etc.) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  THEME (ACCENT COLOR)
                </Label>
                <span className="text-xs text-muted-foreground font-medium">
                  Primary brand & interaction color
                </span>
              </div>
              <Select
                value={currentThemeColor}
                onValueChange={(val) => handleThemeColorChange(val as ShadcnThemeColor)}
              >
                <SelectTrigger className="bg-background/60 h-11 border-border/80">
                  <div className="flex items-center justify-between w-full pr-2">
                    <span className="font-medium text-sm">
                      {SHADCN_THEME_COLORS[currentThemeColor]?.name || "Mist"}
                    </span>
                    <span
                      className="w-3.5 h-3.5 rounded-full border border-border shrink-0 shadow-2xs"
                      style={{
                        backgroundColor: SHADCN_THEME_COLORS[currentThemeColor]?.dotColor || "#007a55",
                      }}
                    />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(SHADCN_THEME_COLORS) as ShadcnThemeColor[]).map((key) => {
                    const item = SHADCN_THEME_COLORS[key];
                    return (
                      <SelectItem key={key} value={key}>
                        <div className="flex items-center justify-between gap-4 w-full min-w-[200px]">
                          <span>{item.name}</span>
                          <span
                            className="w-3.5 h-3.5 rounded-full border border-border shadow-2xs shrink-0"
                            style={{ backgroundColor: item.dotColor }}
                          />
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Quick Presets & Shuffle (Screenshot 2: --preset b7Uc9EOwq / Shuffle) */}
            <div className="pt-2 border-t border-border/50 space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                POPULAR SHADCN PRESETS
              </Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => applyPreset("mist")}
                  className={`text-xs h-9 justify-start gap-1.5 ${
                    currentBaseColor === "mist" && currentThemeColor === "mist"
                      ? "border-primary bg-primary/10 text-primary font-bold"
                      : ""
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-[#007a55]" />
                  Mist (Default)
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => applyPreset("zinc")}
                  className={`text-xs h-9 justify-start gap-1.5 ${
                    currentBaseColor === "zinc" && currentThemeColor === "zinc"
                      ? "border-primary bg-primary/10 text-primary font-bold"
                      : ""
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-[#18181b] dark:bg-[#fafafa]" />
                  Zinc
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => applyPreset("taupe")}
                  className={`text-xs h-9 justify-start gap-1.5 ${
                    currentBaseColor === "taupe" && currentThemeColor === "taupe"
                      ? "border-primary bg-primary/10 text-primary font-bold"
                      : ""
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-[#786049]" />
                  Taupe
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => applyPreset("slate")}
                  className={`text-xs h-9 justify-start gap-1.5 ${
                    currentBaseColor === "slate" && currentThemeColor === "blue"
                      ? "border-primary bg-primary/10 text-primary font-bold"
                      : ""
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-[#2563eb]" />
                  Slate & Blue
                </Button>
              </div>

              <div className="pt-1 flex items-center justify-between">
                <span className="text-[11px] font-mono text-muted-foreground">
                  Active: --preset {currentBaseColor}-{currentThemeColor}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleShuffle}
                  className="h-7 px-2.5 text-xs text-primary hover:bg-primary/10 gap-1.5 cursor-pointer"
                >
                  <Shuffle className="w-3.5 h-3.5" />
                  Shuffle Theme
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>



        {/* Display & Typography */}
        <Card className="bg-card/40 backdrop-blur-md border-primary/10 shadow-xl">
          <CardHeader className="pb-4 border-b border-primary/5 bg-primary/5">
            <div className="flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Typography & Layout</CardTitle>
            </div>
            <CardDescription>Fine-tune the reading experience.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div className="space-y-3">
              <Label className="text-sm font-medium">Font Family</Label>
              <Select
                value={themeSettings.fontFamily || "Geist"}
                onValueChange={(value) => handleSettingChange("fontFamily", value)}
              >
                <SelectTrigger className="bg-background/50 h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Geist">Geist (shadcn Default — Recommended)</SelectItem>
                  <SelectItem value="Inter">Inter (Clean & Corporate)</SelectItem>
                  <SelectItem value="System">System Default</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-medium">Font Scaling</Label>
              <Select
                value={themeSettings.fontSize}
                onValueChange={(value) => handleSettingChange("fontSize", value)}
              >
                <SelectTrigger className="bg-background/50 h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {fontSizes.map((size) => (
                    <SelectItem key={size.value} value={size.value}>
                      {size.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between p-4 rounded-xl bg-muted/20">
              <div className="space-y-0.5">
                <Label className="text-base font-semibold">Compact Layout</Label>
                <div className="text-sm text-muted-foreground">
                  Reduce padding for high-density information
                </div>
              </div>
              <Switch
                checked={themeSettings.compactMode}
                onCheckedChange={(checked) => handleSettingChange("compactMode", checked)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Accessibility & Effects */}
        <Card className="bg-card/40 backdrop-blur-md border-primary/10 shadow-xl">
          <CardHeader className="pb-4 border-b border-primary/5 bg-primary/5">
            <div className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Performance & Accessibility</CardTitle>
            </div>
            <CardDescription>Settings for specialized needs.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            {[
              {
                id: "animations",
                label: "Enable Visual Effects",
                desc: "Show smooth transitions and animations",
                checked: themeSettings.animations,
              },
              {
                id: "isGlassmorphism",
                label: "Glassmorphism Effect",
                desc: "Apply frosted glass textures and backdrop blur",
                checked: !!themeSettings.isGlassmorphism,
              },
              {
                id: "highContrast",
                label: "High Contrast",
                desc: "Increase color contrast for visibility",
                checked: themeSettings.highContrast,
              },
              {
                id: "reducedMotion",
                label: "Reduced Motion",
                desc: "Minimize movement and parallax",
                checked: themeSettings.reducedMotion,
              },
            ].map((item) => (
              <div key={item.id} className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">{item.label}</Label>
                  <div className="text-xs text-muted-foreground">{item.desc}</div>
                </div>
                <Switch
                  checked={item.checked}
                  onCheckedChange={(checked) => handleSettingChange(item.id as any, checked)}
                />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}