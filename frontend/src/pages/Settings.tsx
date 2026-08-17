import { useSEO } from "@/hooks/useSEO";
import { Mail, Shield, Bell, Save, Palette, FileText, Award, MapPin } from "lucide-react";
import MailConfig from "./settings/MailConfig";
import ThemeSettings from "./settings/ThemeSettings";
import ReminderConfig from "./settings/ReminderConfig";
import SettingsLayout, { SettingsTabItem } from "./settings/SettingsLayout";
import ValidationSettings from "./settings/ValidationSettings";
import BackupSettings from "./settings/BackupSettings";
import ReportConfig from "./settings/ReportConfig";
import CertificateConfig from "./settings/CertificateConfig";
import LocationSettings from "./settings/LocationSettings";

export default function Settings() {
  useSEO({
    title: "Settings — Calibration Alerts",
    description: "Configure your preferences and app settings.",
  });

  const tabs: SettingsTabItem[] = [
    {
      category: "Notifications & Routing",
      value: "mail",
      label: "Mail Configuration",
      icon: <Mail className="w-4 h-4 text-blue-500" />,
      content: <MailConfig />,
    },
    {
      category: "Notifications & Routing",
      value: "locations",
      label: "Location Heads & Routing",
      icon: <MapPin className="w-4 h-4 text-sky-500" />,
      content: <LocationSettings />,
    },
    {
      category: "Notifications & Routing",
      value: "reminders",
      label: "Reminder Settings",
      icon: <Bell className="w-4 h-4 text-amber-500" />,
      content: <ReminderConfig />,
    },
    {
      category: "Templates & Data Fields",
      value: "validation",
      label: "Field Validation & Custom Columns",
      icon: <Shield className="w-4 h-4 text-emerald-500" />,
      content: <ValidationSettings />,
    },
    {
      category: "Templates & Data Fields",
      value: "report",
      label: "Report Format",
      icon: <FileText className="w-4 h-4 text-violet-500" />,
      content: <ReportConfig />,
    },
    {
      category: "Templates & Data Fields",
      value: "certificate",
      label: "Certificate Config",
      icon: <Award className="w-4 h-4 text-teal-500" />,
      content: <CertificateConfig />,
    },
    {
      category: "System Preferences",
      value: "backup",
      label: "Backup & Restore",
      icon: <Save className="w-4 h-4 text-indigo-500" />,
      content: <BackupSettings />,
    },
    {
      category: "System Preferences",
      value: "appearance",
      label: "Appearance",
      icon: <Palette className="w-4 h-4 text-rose-500" />,
      content: <ThemeSettings />,
    },
  ];

  return <SettingsLayout defaultTab="mail" tabs={tabs} />;
}