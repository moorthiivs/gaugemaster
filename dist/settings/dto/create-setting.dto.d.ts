declare class SmtpConfigDto {
    host: string;
    port: number;
    user: string;
    pass: string;
    secure: boolean;
    fromEmail: string;
}
export declare class CreateSettingDto {
    userId: string;
    companyId: string;
    smtpConfig?: SmtpConfigDto;
    reminderFrequency?: string;
    juniorRecipients?: string[];
    seniorRecipients?: string[];
    supervisorRecipients?: string[];
}
export {};
