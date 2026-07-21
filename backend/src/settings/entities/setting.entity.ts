import { Entity, Column, PrimaryColumn } from "typeorm";
import { v4 as uuidv4 } from "uuid";

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
    juniorRecipients: string[];

    // Calibration Senior recipients
    @Column({ type: "jsonb", default: () => "'[]'", nullable: true })
    seniorRecipients: string[];

    // Supervisor recipients
    @Column({ type: "jsonb", default: () => "'[]'", nullable: true })
    supervisorRecipients: string[];

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
    };
}
