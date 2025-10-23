export declare class Setting {
    id: string;
    userId: string;
    companyId: string;
    smtpConfig: {
        smtpPort: number;
        encryption: string;
        username: any;
        password: any;
        smtpServer: any;
        secure: boolean;
    };
    reminderFrequency: string;
    juniorRecipients: string[];
    seniorRecipients: string[];
    supervisorRecipients: string[];
}
