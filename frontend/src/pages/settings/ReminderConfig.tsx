import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { X, Plus, Mail, Clock, AlertCircle, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import httpClient from "@/lib/httpClient";
import { Skeleton } from "@/components/ui/skeleton";
import FrequencyDialog from "@/components/FrequencyDialog";

type ReminderRole = "junior" | "senior" | "supervisor";
type ReminderFrequency = "normal" | "important" | "critical";

interface ReminderConfig {
  frequency: ReminderFrequency;
  recipients: {
    junior: string[];
    senior: string[];
    supervisor: string[];
  };
}

export default function ReminderConfig() {


  const { user, setUser } = useAuth()
  const [config, setConfig] = useState<ReminderConfig>({
    frequency: "normal",
    recipients: {
      junior: [],
      senior: [],
      supervisor: [],
    },
  });
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [isFrequencymodel, setisFrequencymodel] = useState(false);

  const [recipient_role, setrecipient_role] = useState('')

  const [frequencyData, setfrequencyData] = useState([]);

  const [emailInputs, setEmailInputs] = useState({
    junior: "",
    senior: "",
    supervisor: "",
  });

  const roleInfo = {
    junior: {
      title: "Calibration Junior/Engineer",
      description: "Receives reminders 2 days before due date",
      icon: "👨‍🔧",
      color: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
    },
    senior: {
      title: "Calibration Senior",
      description: "Receives reminders on the due date",
      icon: "👨‍💼",
      color: "bg-purple-500/10 text-purple-700 dark:text-purple-300",
    },
    supervisor: {
      title: "Supervisor",
      description: "Receives urgent reminders 7 days after due date",
      icon: "👔",
      color: "bg-red-500/10 text-red-700 dark:text-red-300",

    },
  };

  const frequencyOptions = [
    {
      value: "normal",
      label: "Normal",
      description: "Standard reminder frequency",
      color: "bg-green-500",
    },
    {
      value: "important",
      label: "Important",
      description: "Increased reminder frequency",
      color: "bg-orange-500",
    },
    {
      value: "critical",
      label: "Critical",
      description: "Maximum reminder frequency",
      color: "bg-red-500",
    },
  ];

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  };

  const addEmail = (role: ReminderRole) => {
    const email = emailInputs[role].trim();

    if (!email) {
      toast({
        title: "Email required",
        description: "Please enter an email address",
        variant: "destructive",
      });
      return;
    }

    if (!validateEmail(email)) {
      toast({
        title: "Invalid email",
        description: "Please enter a valid email address",
        variant: "destructive",
      });
      return;
    }

    if (config.recipients[role].includes(email)) {
      toast({
        title: "Duplicate email",
        description: "This email is already added",
        variant: "destructive",
      });
      return;
    }

    setConfig((prev) => ({
      ...prev,
      recipients: {
        ...prev.recipients,
        [role]: [...prev.recipients[role], email],
      },
    }));

    setEmailInputs((prev) => ({ ...prev, [role]: "" }));

    toast({
      title: "Email added",
      description: `${email} will receive ${role} reminders`,
    });
  };

  const removeEmail = (role: ReminderRole, email: string) => {
    setConfig((prev) => ({
      ...prev,
      recipients: {
        ...prev.recipients,
        [role]: prev.recipients[role].filter((e) => e !== email),
      },
    }));

    toast({
      title: "Email removed",
      description: `${email} has been removed from ${role} recipients`,
    });
  };

  const handleSave = async () => {
    const totalRecipients =
      config.recipients.junior.length +
      config.recipients.senior.length +
      config.recipients.supervisor.length;

    if (totalRecipients === 0) {
      toast({
        title: "No recipients",
        description: "Please add at least one email recipient",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSaving(true); // 👈 Start loading
      const allData = {
        juniorRecipients: config.recipients.junior,
        seniorRecipients: config.recipients.senior,
        supervisorRecipients: config.recipients.supervisor,
        reminderFrequency: config.frequency,
        userId: user.id,
        companyId: user.companyId
      }
      const response = await httpClient.post('/settings/mailconfig', allData)

      if (response.status === 201 || response.status === 200) {
        const { id } = response.data
        const updatedUser = {
          ...user,
          settingsid: id
        };
        setUser(updatedUser)
        toast({
          title: "Configuration saved",
          description: `Reminder settings saved with ${totalRecipients} total recipients`,
        });
      }

    } catch (error) {
      console.log(error);
    } finally {
      setIsSaving(false); // 👈 Stop loading
    }
  };

  const fetchemailConfig = async () => {
    try {
      setLoading(true);
      const params = { userId: user.id, companyId: user.companyId };
      const response = await httpClient.get('/settings/fetchmailconfig', { params })

      if (response.status === 200 && response.data) {
        const data = response.data;
        setConfig({
          frequency: data.reminderFrequency || "normal",
          recipients: {
            junior: data.juniorRecipients || [],
            senior: data.seniorRecipients || [],
            supervisor: data.supervisorRecipients || [],
          },
        });
      }
    } catch (error) {
      console.log(error);
    } finally {
      setLoading(false);
    }
  }


  useEffect(() => {
    fetchemailConfig()
  }, [user])


  console.log(frequencyData, "frequencyData");

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="flex items-center gap-3 mb-6">
          <Skeleton className="h-6 w-6 rounded-full" />
          <Skeleton className="h-5 w-32" />
        </div>

        {[...Array(4)].map((_, i) => (
          <Card key={i} className="bg-card/50 border-border/50">
            <CardHeader>
              <Skeleton className="h-4 w-40 mb-2" />
              <Skeleton className="h-3 w-64" />
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-10 w-full rounded-md" />
              <Skeleton className="h-8 w-1/2 rounded-md" />
            </CardContent>
          </Card>
        ))}

        <div className="flex justify-end gap-3 pt-4">
          <Skeleton className="h-10 w-32 rounded-md" />
          <Skeleton className="h-10 w-40 rounded-md" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
         {/* Frequency Selection */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            <CardTitle>Reminder Frequency</CardTitle>
          </div>
          <CardDescription>
            Set the priority level for calibration reminders
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Select
              value={config.frequency}
              onValueChange={(value: ReminderFrequency) =>
                setConfig((prev) => ({ ...prev, frequency: value }))
              }
            >
              <SelectTrigger className="h-12">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {frequencyOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${option.color}`} />
                      <div>
                        <div className="font-medium">{option.label}</div>
                        <div className="text-xs text-muted-foreground">
                          {option.description}
                        </div>
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-start gap-2 p-4 bg-muted/50 rounded-lg">
              <AlertCircle className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-medium mb-1">Current Setting: {config.frequency.charAt(0).toUpperCase() + config.frequency.slice(1)}</p>
                <p className="text-muted-foreground">
                  {config.frequency === "normal" && "Reminders will be sent at standard intervals"}
                  {config.frequency === "important" && "Reminders will be sent more frequently with increased priority"}
                  {config.frequency === "critical" && "Reminders will be sent with maximum frequency and highest priority"}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      {/* Email Recipients by Role */}
      {(Object.keys(roleInfo) as ReminderRole[]).map((role) => (
        <Card key={role} className="animate-fade-in">
          <CardHeader>
            <div className="flex items-center gap-3">

              <div className={`p-3 rounded-lg ${roleInfo[role].color}`}>
                <span className="text-2xl">{roleInfo[role].icon}</span>
              </div>
              <div className=" w-full flex items-center justify-between">
                <div>
                  <CardTitle>{roleInfo[role].title}</CardTitle>
                  <CardDescription>{roleInfo[role].description}</CardDescription>
                </div>

                <Button variant="info" onClick={() => {
                  setisFrequencymodel(true)
                  setrecipient_role(roleInfo[role].title)
                }}>Set Frequency</Button>
              </div>




            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Add Email Input */}
            <div className="flex gap-2">
              <div className="flex-1">
                <Input
                  type="email"
                  placeholder="Enter email address"
                  value={emailInputs[role]}
                  onChange={(e) =>
                    setEmailInputs((prev) => ({ ...prev, [role]: e.target.value }))
                  }
                  name={`email-${role}`}
                  autoComplete="new-email"
                  onKeyPress={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addEmail(role);
                    }
                  }}
                  className="h-10"
                />
              </div>
              <Button onClick={() => addEmail(role)} size="default">
                <Plus className="w-4 h-4 mr-2" />
                Add
              </Button>
            </div>

            {/* Email List */}
            {config.recipients[role].length > 0 ? (
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Recipients ({config.recipients[role].length})
                </Label>
                <div className="flex flex-wrap gap-2">
                  {config.recipients[role].map((email) => (
                    <Badge
                      key={email}
                      variant="secondary"
                      className="px-3 py-1.5 text-sm flex items-center gap-2 hover:bg-secondary/80 transition-colors"
                    >
                      <Mail className="w-3 h-3" />
                      {email}
                      <button
                        onClick={() => removeEmail(role, email)}
                        className="ml-1 hover:text-destructive transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground text-sm bg-muted/30 rounded-lg border-2 border-dashed">
                <Mail className="w-8 h-8 mx-auto mb-2 opacity-50" />
                No email addresses added yet
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      {/* Save Button */}
      {/* <div className="flex justify-end gap-3 sticky bottom-4 bg-background/80 backdrop-blur-sm p-4 rounded-lg border">
        <Button variant="outline" onClick={() => window.location.reload()}>
          Reset
        </Button>
        <Button onClick={handleSave} >
          Save Configuration
        </Button>
      </div> */}


      <div className="flex justify-end gap-3 pt-4">
        <Button variant="outline" onClick={() => window.location.reload()}>
          Reset
        </Button>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            "Save Configuration"
          )}
        </Button>
      </div>


      {isFrequencymodel && (
        <FrequencyDialog open={isFrequencymodel} onClose={() => setisFrequencymodel(false)} data={frequencyData} setData={setfrequencyData} recipient_role={recipient_role} />
      )}

    </div>
  );
}
