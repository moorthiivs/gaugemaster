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
}
