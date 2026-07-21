import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";
import { useSEO } from "@/hooks/useSEO";

export default function Profile() {
  useSEO({ title: "Profile — Calibration Alerts", description: "Your profile and account details." });
  const { user } = useAuth();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <dt className="text-sm text-muted-foreground">Name</dt>
            <dd className="font-medium">{user?.name}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Email</dt>
            <dd className="font-medium">{user?.email}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Role</dt>
            <dd className="font-medium">{user?.role}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Provider</dt>
            <dd className="font-medium">{user?.provider}</dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}
