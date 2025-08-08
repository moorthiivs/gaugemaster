import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSEO } from "@/hooks/useSEO";

export default function Settings() {
  useSEO({ title: "Settings — Calibration Alerts", description: "Configure your preferences and app settings." });
  return (
    <Card>
      <CardHeader>
        <CardTitle>Settings</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">General settings will appear here.</p>
      </CardContent>
    </Card>
  );
}
