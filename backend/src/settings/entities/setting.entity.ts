import { Entity, Column, PrimaryColumn } from "typeorm";
import { v4 as uuidv4 } from "uuid";

export interface ReminderRecipientConfig {
    email: string;
    location?: string;
}

@Entity({ name: "settings" })
export class Setting {
    @PrimaryColumn("uuid")
    id: string = uuidv4();

    @Column({ type: "uuid" })
    userId: string;

    @Column({ type: "uuid" })
    companyId: string;

    // SMTP configuration
    @Column({ type: "jsonb", nullable: true })
    smtpConfig: {
        smtpPort: number;
        encryption: string;
        username: any;
        password: any;
        smtpServer: any;
        secure: boolean;
    };

    @Column({ type: "varchar", length: 50, default: "normal", nullable: true })
    reminderFrequency: string;

    @Column({ type: "jsonb", default: () => "'[]'", nullable: true })
    juniorRecipients: (string | ReminderRecipientConfig)[];

    // Calibration Senior recipients
    @Column({ type: "jsonb", default: () => "'[]'", nullable: true })
    seniorRecipients: (string | ReminderRecipientConfig)[];

    // Supervisor recipients
    @Column({ type: "jsonb", default: () => "'[]'", nullable: true })
    supervisorRecipients: (string | ReminderRecipientConfig)[];

    @Column({ type: "jsonb", nullable: true })
    defaultBulkReminderColumns?: string[];

    @Column({ type: "jsonb", nullable: true })
    themeSettings: {
        primaryColor: string;
        sidebarColor: string;
        sidebarTextColor: string;
        sidebarIconColor: string;
        accentColor: string;
        isGlassmorphism: boolean;
    };

    @Column({ type: "jsonb", nullable: true })
    reportConfig: {
        headerText: string;
        footerText: string;
    };

    @Column({ type: "jsonb", nullable: true })
    certificateConfig: {
        // Certificate Number Format
        certPrefix: string;       // Default: "CAL/CERT"
        certSeparator: string;    // Default: "/"
        certYearFormat: string;   // Default: "YYYY" (or "YY")
        certSeqLength: number;    // Default: 5
        certNextSeq: number;      // Auto-incremented, starts at 0

        // ULR Number Format
        ulrPrefix: string;        // Default: "ULR"
        ulrSeparator: string;     // Default: "/"
        ulrYearFormat: string;    // Default: "YYYY"
        ulrSeqLength: number;     // Default: 5
        ulrNextSeq: number;       // Auto-incremented, starts at 0

        headerCompanyName?: string;
        headerCompanySubtitle?: string;
        headerRightBoxText1?: string;
        headerRightBoxText2?: string;
        footerLine1?: string;
        footerLine2?: string;
        footerLine3?: string;

        // Certificate Appearance
        borderColor?: string;          // Default: "#0369a1" — top/bottom strip color
        headerBgColor?: string;        // Default: "#54c6f3" — header/footer banner background color
        headerDisplayMode?: string;    // "name" | "logo" | "both"
        companyLogoPath?: string;      // Path to uploaded logo image
    };

    @Column({ type: "jsonb", nullable: true })
    dashboardConfig: {
        warningDays?: number;
        widgets?: Record<string, boolean>;
    };

    @Column({ type: "integer", default: 15, nullable: true })
    dueReminderThresholdDays: number;

    @Column({ type: "jsonb", nullable: true })
    summaryReportConfig: {
        enabled: boolean;
        frequency: string; // 'daily' | 'weekly' | 'monthly'
        managementRecipients?: string[];
    };
}

