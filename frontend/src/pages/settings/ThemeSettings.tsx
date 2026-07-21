import { useThemeSettings } from "@/lib/ThemeContext";
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
                title: "Appearance Saved",
                description: "Your personalized theme has been updated and synced.",
            });
        } catch (error) {
            toast({
                title: "Save Failed",
                description: "There was an error saving your theme preferences.",
                variant: "destructive"
            });
        }
    };

    const handleSettingChange = (field: keyof typeof themeSettings, value: any) => {
        setThemeSettings(prev => ({
            ...prev,
            [field]: value
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-primary/10 rounded-2xl shadow-inner">
                        <Palette className="h-7 w-7 text-primary" />
                    </div>
                    <div>
                        <h2 className="text-3xl font-bold tracking-tight">Appearance</h2>
                        <p className="text-muted-foreground">Personalize your workspace with custom colors and effects.</p>
                    </div>
                </div>
                <div className="flex gap-3">
                    <Button variant="outline" onClick={() => window.location.reload()}>
                        Reset Changes
                    </Button>
                    <Button onClick={handleSave} className="shadow-lg shadow-primary/20 px-8">
                        Save Changes
                    </Button>
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                {/* Color Scheme */}
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
                                    className={`p-4 rounded-xl border-2 cursor-pointer transition-all duration-300 group ${themeSettings.colorScheme === scheme.value
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
                                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${themeSettings.colorScheme === scheme.value
                                            ? "border-primary bg-primary"
                                            : "border-muted-foreground/30"
                                            }`}>
                                            {themeSettings.colorScheme === scheme.value && <div className="w-2 h-2 rounded-full bg-white" />}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Custom Colors */}
                <Card className="bg-card/40 backdrop-blur-md border-primary/10 shadow-xl">
                    <CardHeader className="pb-4 border-b border-primary/5 bg-primary/5">
                        <div className="flex items-center gap-2">
                            <Sparkles className="h-5 w-5 text-primary" />
                            <CardTitle className="text-lg">Custom Colors</CardTitle>
                        </div>
                        <CardDescription>
                            Inject your brand colors into the dashboard.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Primary Theme Color</Label>
                                <div className="flex gap-2">
                                    <Input 
                                        type="color" 
                                        value={themeSettings.primaryColor || "#3b82f6"} 
                                        onChange={(e) => handleSettingChange("primaryColor", e.target.value)}
                                        className="w-12 h-10 p-1 cursor-pointer border-none bg-transparent"
                                    />
                                    <Input 
                                        type="text" 
                                        value={themeSettings.primaryColor} 
                                        onChange={(e) => handleSettingChange("primaryColor", e.target.value)}
                                        className="font-mono text-sm uppercase"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Sidebar Base</Label>
                                <div className="flex gap-2">
                                    <Input 
                                        type="color" 
                                        value={themeSettings.sidebarColor || "#0f172a"} 
                                        onChange={(e) => handleSettingChange("sidebarColor", e.target.value)}
                                        className="w-12 h-10 p-1 cursor-pointer border-none bg-transparent"
                                    />
                                    <Input 
                                        type="text" 
                                        value={themeSettings.sidebarColor} 
                                        onChange={(e) => handleSettingChange("sidebarColor", e.target.value)}
                                        className="font-mono text-sm uppercase"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Accent & Highlight</Label>
                            <div className="flex gap-2">
                                <Input 
                                    type="color" 
                                    value={themeSettings.accentColor || "#3b82f6"} 
                                    onChange={(e) => handleSettingChange("accentColor", e.target.value)}
                                    className="w-12 h-10 p-1 cursor-pointer border-none bg-transparent"
                                />
                                <div className="flex-1 grid grid-cols-4 gap-1">
                                    {["#3b82f6", "#8b5cf6", "#ec4899", "#f97316"].map(c => (
                                        <button 
                                            key={c}
                                            onClick={() => handleSettingChange("accentColor", c)}
                                            className="h-10 rounded-md border border-primary/10 shadow-sm transition-transform hover:scale-105"
                                            style={{ backgroundColor: c }}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center justify-between p-4 rounded-xl bg-primary/5 border border-primary/10">
                            <div className="space-y-0.5">
                                <Label className="text-base font-semibold">Glassmorphism Effect</Label>
                                <div className="text-sm text-muted-foreground">
                                    Apply frosted glass textures to UI elements
                                </div>
                            </div>
                            <Switch
                                checked={themeSettings.isGlassmorphism}
                                onCheckedChange={(checked) => handleSettingChange("isGlassmorphism", checked)}
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* Display & Text */}
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

                {/* Accessibility */}
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
                            { id: "high-contrast", label: "High Contrast", desc: "Increase color contrast for visibility", checked: themeSettings.highContrast },
                            { id: "reduced-motion", label: "Reduced Motion", desc: "Minimize movement and parallax", checked: themeSettings.reducedMotion },
                        ].map(item => (
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