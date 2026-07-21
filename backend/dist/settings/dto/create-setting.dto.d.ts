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
    themeSettings?: {
        colorScheme: string;
        primaryColor: string;
        sidebarColor: string;
        accentColor: string;
        isGlassmorphism: boolean;
        fontSize: string;
        compactMode: boolean;
        animations: boolean;
        highContrast: boolean;
        reducedMotion: boolean;
        fontFamily?: string;
    };
    reportConfig?: {
        headerText: string;
        footerText: string;
    };
    certificateConfig?: {
        certPrefix: string;
        certSeparator: string;
        certYearFormat: string;
        certSeqLength: number;
        certNextSeq: number;
        ulrPrefix: string;
        ulrSeparator: string;
        ulrYearFormat: string;
        ulrSeqLength: number;
        ulrNextSeq: number;
    };
}
export {};
