import { useThemeSettings, defaultDarkTheme, defaultLightTheme } from "@/lib/ThemeContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Palette, Monitor, Smartphone, Globe, Sparkles } from "lucide-react";

export default function ThemeSettings() {
  const { toast } = useToast();
  const { themeSettings, setThemeSettings, saveTheme } = useThemeSettings();

  const handleSave = async () => {
    try {
      await saveTheme(themeSettings);
      toast({
        title: "Appearance Saved to Database",
        description: "Your custom dark & light mode colors have been saved to your account.",
      });
    } catch (error) {
      toast({
        title: "Save Failed",
        description: "There was an error saving your theme preferences to database.",
        variant: "destructive",
      });
    }
  };

  const isDarkActive = themeSettings.colorScheme === "dark" || (themeSettings.colorScheme === "auto" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  const activeProfileKey = isDarkActive ? "darkTheme" : "lightTheme";
  const defaultProfile = isDarkActive ? defaultDarkTheme : defaultLightTheme;
  const currentProfile = themeSettings[activeProfileKey] || defaultProfile;

  const handleProfileColorChange = (field: keyof typeof defaultDarkTheme, value: any) => {
    setThemeSettings((prev) => {
      const existingProfile = prev[activeProfileKey] || (isDarkActive ? defaultDarkTheme : defaultLightTheme);
      const updatedProfile = { ...existingProfile, [field]: value };
      return {
        ...prev,
        [activeProfileKey]: updatedProfile,
        // Sync flat values for instant preview
        ...(field === "primaryColor" ? { primaryColor: value } : {}),
        ...(field === "sidebarColor" ? { sidebarColor: value } : {}),
        ...(field === "accentColor" ? { accentColor: value } : {}),
        ...(field === "isGlassmorphism" ? { isGlassmorphism: value } : {}),
      };
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
              Personalize your workspace with separate Dark Mode & Light Mode custom colors.
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
            <CardDescription>
              Choose the overall brightness of the system.
            </CardDescription>
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
                      {themeSettings.colorScheme === scheme.value && <div className="w-2 h-2 rounded-full bg-white" />}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Custom Colors & Effects for Active Mode */}
        <Card className="bg-card/40 backdrop-blur-md border-primary/10 shadow-xl">
          <CardHeader className="pb-4 border-b border-primary/5 bg-primary/5 flex flex-row items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Custom Colors ({isDarkActive ? "Dark Mode" : "Light Mode"})</CardTitle>
              </div>
              <CardDescription>
                Customize colors stored separately for {isDarkActive ? "Dark Mode" : "Light Mode"}.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              {/* Primary Theme Color */}
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">PRIMARY THEME COLOR</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={currentProfile.primaryColor || "#3b82f6"}
                    onChange={(e) => handleProfileColorChange("primaryColor", e.target.value)}
                    className="w-12 h-10 p-1 cursor-pointer border-none bg-transparent"
                  />
                  <Input
                    type="text"
                    value={currentProfile.primaryColor}
                    onChange={(e) => handleProfileColorChange("primaryColor", e.target.value)}
                    className="font-mono text-sm uppercase"
                  />
                </div>
              </div>

              {/* Sidebar Base */}
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">SIDEBAR BASE</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={currentProfile.sidebarColor || "#0f172a"}
                    onChange={(e) => handleProfileColorChange("sidebarColor", e.target.value)}
                    className="w-12 h-10 p-1 cursor-pointer border-none bg-transparent"
                  />
                  <Input
                    type="text"
                    value={currentProfile.sidebarColor}
                    onChange={(e) => handleProfileColorChange("sidebarColor", e.target.value)}
                    className="font-mono text-sm uppercase"
                  />
                </div>
              </div>
            </div>

            {/* Accent & Highlight */}
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">ACCENT & HIGHLIGHT</Label>
              <div className="flex gap-2">
                <Input
                  type="color"
                  value={currentProfile.accentColor || "#3b82f6"}
                  onChange={(e) => handleProfileColorChange("accentColor", e.target.value)}
                  className="w-12 h-10 p-1 cursor-pointer border-none bg-transparent"
                />
                <div className="flex-1 grid grid-cols-5 gap-1">
                  {["#3b82f6", "#2563eb", "#8b5cf6", "#ec4899", "#f97316"].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => handleProfileColorChange("accentColor", c)}
                      className="h-10 rounded-md border border-primary/10 shadow-sm transition-transform hover:scale-105"
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Glassmorphism Effect Toggle */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-primary/5 border border-primary/10">
              <div className="space-y-0.5">
                <Label className="text-base font-semibold">Glassmorphism Effect</Label>
                <div className="text-sm text-muted-foreground">
                  Apply frosted glass textures to UI elements in {isDarkActive ? "Dark Mode" : "Light Mode"}
                </div>
              </div>
              <Switch
                checked={currentProfile.isGlassmorphism}
                onCheckedChange={(checked) => handleProfileColorChange("isGlassmorphism", checked)}
              />
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
            <CardDescription>
              Fine-tune the reading experience.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div className="space-y-3">
              <Label className="text-sm font-medium">Font Family</Label>
              <Select
                value={themeSettings.fontFamily || "Inter"}
                onValueChange={(value) => handleSettingChange("fontFamily", value)}
              >
                <SelectTrigger className="bg-background/50 h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Inter">Inter (Clean & Corporate)</SelectItem>
                  <SelectItem value="Plus Jakarta Sans">Plus Jakarta Sans (Modern & Friendly)</SelectItem>
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
            <CardDescription>
              Settings for specialized needs.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            {[
              { id: "animations", label: "Enable Visual Effects", desc: "Show smooth transitions and animations", checked: themeSettings.animations },
              { id: "highContrast", label: "High Contrast", desc: "Increase color contrast for visibility", checked: themeSettings.highContrast },
              { id: "reducedMotion", label: "Reduced Motion", desc: "Minimize movement and parallax", checked: themeSettings.reducedMotion },
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