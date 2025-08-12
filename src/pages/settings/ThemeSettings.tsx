import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Palette, Monitor, Smartphone, Globe } from "lucide-react";
import { useTheme } from "next-themes";
//import { useThemeSettings } from "@/lib/ThemeContext";

export default function ThemeSettings() {
    const { toast } = useToast();
    const { theme, setTheme } = useTheme();

    const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");

    const [themeSettings, setThemeSettings] = useState({
        colorScheme: "dark",
        fontSize: "medium",
        compactMode: false,
        animations: true,
        highContrast: false,
        reducedMotion: false,
    });

    // const { themeSettings, setThemeSettings } = useThemeSettings();

    const handleSave = () => {
        toast({
            title: "Theme settings saved",
            description: "Your appearance preferences have been updated.",
        });
    };

    const handleSettingChange = (field: string, value: string | boolean) => {
        setTheme(value === "dark" ? "light" : "dark")
        setThemeSettings(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const colorSchemes = [
        { value: "dark", label: "Dark Mode", description: "Dark theme for reduced eye strain" },
        { value: "light", label: "Light Mode", description: "Light theme for bright environments" },
        { value: "auto", label: "System", description: "Follow system preference" },
    ];

    const fontSizes = [
        { value: "small", label: "Small" },
        { value: "medium", label: "Medium" },
        { value: "large", label: "Large" },
        { value: "extra-large", label: "Extra Large" },
    ];





    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-primary/10 rounded-lg">
                    <Palette className="h-6 w-6 text-primary" />
                </div>
                <div>
                    <h2 className="text-2xl font-bold">Appearance Settings</h2>
                    <p className="text-muted-foreground">Customize the look and feel of your application</p>
                </div>
            </div>

            <div className="grid gap-6">
                {/* Color Scheme */}
                <Card className="bg-card/50 border-border/50">
                    <CardHeader className="pb-4">
                        <div className="flex items-center gap-2">
                            <Monitor className="h-5 w-5 text-primary" />
                            <CardTitle className="text-lg">Color Scheme</CardTitle>
                        </div>
                        <CardDescription>
                            Choose your preferred color scheme
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-3">
                            {colorSchemes.map((scheme) => (
                                <div
                                    key={scheme.value}
                                    className={`p-4 rounded-lg border-2 cursor-pointer transition-all duration-200 ${themeSettings.colorScheme === scheme.value
                                        ? "border-primary bg-primary/5"
                                        : "border-border hover:border-border/80"
                                        }`}
                                    onClick={() => handleSettingChange("colorScheme", scheme.value)}
                                >
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <div className="font-medium">{scheme.label}</div>
                                            <div className="text-sm text-muted-foreground">{scheme.description}</div>
                                        </div>
                                        <div className={`w-4 h-4 rounded-full border-2 ${themeSettings.colorScheme === scheme.value
                                            ? "border-primary bg-primary"
                                            : "border-border"
                                            }`} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Display Settings */}
                <Card className="bg-card/50 border-border/50">
                    <CardHeader className="pb-4">
                        <div className="flex items-center gap-2">
                            <Smartphone className="h-5 w-5 text-primary" />
                            <CardTitle className="text-lg">Display Settings</CardTitle>
                        </div>
                        <CardDescription>
                            Adjust display preferences for better usability
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="font-size">Font Size</Label>
                            <Select
                                value={themeSettings.fontSize}
                                onValueChange={(value) => handleSettingChange("fontSize", value)}
                            >
                                <SelectTrigger className="bg-background/50">
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

                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label htmlFor="compact-mode">Compact Mode</Label>
                                <div className="text-sm text-muted-foreground">
                                    Reduce spacing and padding for more content
                                </div>
                            </div>
                            <Switch
                                id="compact-mode"
                                checked={themeSettings.compactMode}
                                onCheckedChange={(checked) => handleSettingChange("compactMode", checked)}
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* Accessibility */}
                <Card className="bg-card/50 border-border/50">
                    <CardHeader className="pb-4">
                        <div className="flex items-center gap-2">
                            <Globe className="h-5 w-5 text-primary" />
                            <CardTitle className="text-lg">Accessibility</CardTitle>
                        </div>
                        <CardDescription>
                            Configure accessibility features for better usability
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label htmlFor="animations">Enable Animations</Label>
                                <div className="text-sm text-muted-foreground">
                                    Show smooth transitions and animations
                                </div>
                            </div>
                            <Switch
                                id="animations"
                                checked={themeSettings.animations}
                                onCheckedChange={(checked) => handleSettingChange("animations", checked)}
                            />
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label htmlFor="high-contrast">High Contrast</Label>
                                <div className="text-sm text-muted-foreground">
                                    Increase contrast for better visibility
                                </div>
                            </div>
                            <Switch
                                id="high-contrast"
                                checked={themeSettings.highContrast}
                                onCheckedChange={(checked) => handleSettingChange("highContrast", checked)}
                            />
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label htmlFor="reduced-motion">Reduced Motion</Label>
                                <div className="text-sm text-muted-foreground">
                                    Minimize motion for users with vestibular disorders
                                </div>
                            </div>
                            <Switch
                                id="reduced-motion"
                                checked={themeSettings.reducedMotion}
                                onCheckedChange={(checked) => handleSettingChange("reducedMotion", checked)}
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* Action Buttons */}
                <div className="flex justify-end gap-3 pt-4">
                    <Button variant="outline" className="px-6">
                        Reset to Defaults
                    </Button>
                    <Button onClick={handleSave} >
                        Save Changes
                    </Button>
                </div>
            </div>
        </div>
    );
}