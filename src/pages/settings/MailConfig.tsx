import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Mail, Server, Shield, Bell } from "lucide-react";

export default function MailConfig() {
    const { toast } = useToast();
    const [emailSettings, setEmailSettings] = useState({
        smtpServer: "",
        smtpPort: "587",
        username: "",
        password: "",
        encryption: "tls",
        enableNotifications: true,
        enableAlerts: true,
    });

    const handleSave = () => {
        toast({
            title: "Settings saved",
            description: "Your email configuration has been updated successfully.",
        });
    };

    const handleInputChange = (field: string, value: string | boolean) => {
        setEmailSettings(prev => ({
            ...prev,
            [field]: value
        }));
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-primary/10 rounded-lg">
                    <Mail className="h-6 w-6 text-primary" />
                </div>
                <div>
                    <h2 className="text-2xl font-bold">Mail Configuration</h2>
                    <p className="text-muted-foreground">Configure SMTP settings for email notifications</p>
                </div>
            </div>

            <div className="grid gap-6">
                {/* SMTP Server Configuration */}
                <Card className="bg-card/50 border-border/50">
                    <CardHeader className="pb-4">
                        <div className="flex items-center gap-2">
                            <Server className="h-5 w-5 text-primary" />
                            <CardTitle className="text-lg">SMTP Server</CardTitle>
                        </div>
                        <CardDescription>
                            Configure your SMTP server details for outgoing emails
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="smtp-server">SMTP Server</Label>
                                <Input
                                    id="smtp-server"
                                    placeholder="smtp.gmail.com"
                                    value={emailSettings.smtpServer}
                                    onChange={(e) => handleInputChange("smtpServer", e.target.value)}
                                    className="bg-background/50"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="smtp-port">Port</Label>
                                <Input
                                    id="smtp-port"
                                    placeholder="587"
                                    value={emailSettings.smtpPort}
                                    onChange={(e) => handleInputChange("smtpPort", e.target.value)}
                                    className="bg-background/50"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="username">Username</Label>
                                <Input
                                    id="username"
                                    type="email"
                                    placeholder="your-email@gmail.com"
                                    value={emailSettings.username}
                                    onChange={(e) => handleInputChange("username", e.target.value)}
                                    className="bg-background/50"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="password">Password</Label>
                                <Input
                                    id="password"
                                    type="password"
                                    placeholder="••••••••"
                                    value={emailSettings.password}
                                    onChange={(e) => handleInputChange("password", e.target.value)}
                                    className="bg-background/50"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="encryption">Encryption</Label>
                            <Select
                                value={emailSettings.encryption}
                                onValueChange={(value) => handleInputChange("encryption", value)}
                            >
                                <SelectTrigger className="bg-background/50">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="tls">TLS</SelectItem>
                                    <SelectItem value="ssl">SSL</SelectItem>
                                    <SelectItem value="none">None</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </CardContent>
                </Card>

                {/* Notification Settings */}
                <Card className="bg-card/50 border-border/50">
                    <CardHeader className="pb-4">
                        <div className="flex items-center gap-2">
                            <Bell className="h-5 w-5 text-primary" />
                            <CardTitle className="text-lg">Notification Settings</CardTitle>
                        </div>
                        <CardDescription>
                            Configure when and how you receive email notifications
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label htmlFor="notifications">Email Notifications</Label>
                                <div className="text-sm text-muted-foreground">
                                    Receive general email notifications
                                </div>
                            </div>
                            <Switch
                                id="notifications"
                                checked={emailSettings.enableNotifications}
                                onCheckedChange={(checked) => handleInputChange("enableNotifications", checked)}
                            />
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label htmlFor="alerts">Critical Alerts</Label>
                                <div className="text-sm text-muted-foreground">
                                    Receive alerts for critical calibration events
                                </div>
                            </div>
                            <Switch
                                id="alerts"
                                checked={emailSettings.enableAlerts}
                                onCheckedChange={(checked) => handleInputChange("enableAlerts", checked)}
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* Action Buttons */}
                <div className="flex justify-end gap-3 pt-4">
                    <Button variant="outline" className="px-6">
                        Test Connection
                    </Button>
                    <Button onClick={handleSave} >
                        Save Configuration
                    </Button>
                </div>
            </div>
        </div>
    );
}