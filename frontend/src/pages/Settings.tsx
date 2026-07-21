import { useSEO } from "@/hooks/useSEO";
import { Mail, Shield, Bell, Save, Palette, FileText, Award } from "lucide-react";
import MailConfig from "./settings/MailConfig";
import ThemeSettings from "./settings/ThemeSettings";
import ReminderConfig from "./settings/ReminderConfig";
import SettingsLayout from "./settings/SettingsLayout";
import ValidationSettings from "./settings/ValidationSettings";
import BackupSettings from "./settings/BackupSettings";
import ReportConfig from "./settings/ReportConfig";
import CertificateConfig from "./settings/CertificateConfig";

export default function Settings() {
  useSEO({
    title: "Settings — Calibration Alerts",
    description: "Configure your preferences and app settings.",
  });

  const tabs = [
    {
      value: "mail",
      label: "Mail Configuration",
      icon: <Mail className="w-5 h-5 text-blue-500 drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]" />,
      content: <MailConfig />,
    },
    {
      value: "report",
      label: "Report Format",
      icon: <FileText className="w-5 h-5 text-violet-500 drop-shadow-[0_0_8px_rgba(139,92,246,0.5)]" />,
      content: <ReportConfig />,
    },
    {
      value: "certificate",
      label: "Certificate Config",
      icon: <Award className="w-5 h-5 text-teal-500 drop-shadow-[0_0_8px_rgba(20,184,166,0.5)]" />,
      content: <CertificateConfig />,
    },
    {
      value: "validation",
      label: "Field Validation",
      icon: <Shield className="w-5 h-5 text-emerald-500 drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]" />,
      content: <ValidationSettings />,
    },
    {
      value: "reminders",
      label: "Reminder Settings",
      icon: <Bell className="w-5 h-5 text-amber-500 drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]" />,
      content: <ReminderConfig />,
    },
    {
      value: "backup",
      label: "Backup & Restore",
      icon: <Save className="w-5 h-5 text-indigo-500 drop-shadow-[0_0_8px_rgba(99,102,241,0.5)]" />,
      content: <BackupSettings />,
    },
    {
      value: "appearance",
      label: "Appearance",
      icon: <Palette className="w-5 h-5 text-rose-500 drop-shadow-[0_0_8px_rgba(244,63,94,0.5)]" />,
      content: <ThemeSettings />,
    },
  ];

  return <SettingsLayout defaultTab="mail" tabs={tabs} />;
}