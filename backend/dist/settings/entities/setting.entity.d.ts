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
    themeSettings: {
        primaryColor: string;
        sidebarColor: string;
        sidebarTextColor: string;
        sidebarIconColor: string;
        accentColor: string;
        isGlassmorphism: boolean;
    };
    reportConfig: {
        headerText: string;
        footerText: string;
    };
    certificateConfig: {
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
