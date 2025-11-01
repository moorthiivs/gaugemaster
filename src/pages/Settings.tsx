import { useSEO } from "@/hooks/useSEO";
import MailConfig from "./settings/MailConfig";
import ThemeSettings from "./settings/ThemeSettings";
import ReminderConfig from "./settings/ReminderConfig";
import SettingsLayout from "./settings/SettingsLayout";

export default function Settings() {
  useSEO({
    title: "Settings — Calibration Alerts",
    description: "Configure your preferences and app settings.",
  });

  const tabs = [
    {
      value: "mail",
      label: "Mail Configuration",
      icon: "📧",
      content: <MailConfig />,
    },
    {
      value: "reminders",
      label: "Reminder Settings",
      icon: "🔔",
      content: <ReminderConfig />,
    },
    {
      value: "appearance",
      label: "Appearance",
      icon: "🎨",
      content: <ThemeSettings />,
    },
  ];

  return <SettingsLayout defaultTab="mail" tabs={tabs} />;
}