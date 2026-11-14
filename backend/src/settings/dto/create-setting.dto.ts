import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsEmail, IsUUID, IsArray, ValidateNested, IsBoolean, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

class SmtpConfigDto {
    // Primary properties used by frontend MailConfig, Setting entity, and mailer.service.ts
    @ApiProperty({ example: 'smtp.gmail.com', required: false })
    @IsOptional()
    @IsString()
    smtpServer?: string;

    @ApiProperty({ example: 587, required: false })
    @IsOptional()
    smtpPort?: string | number;

    @ApiProperty({ example: 'user@gmail.com', required: false })
    @IsOptional()
    @IsString()
    username?: string;

    @ApiProperty({ example: 'password123', required: false })
    @IsOptional()
    @IsString()
    password?: string;

    @ApiProperty({ example: 'tls', required: false })
    @IsOptional()
    @IsString()
    encryption?: string;

    @ApiProperty({ example: true, required: false })
    @IsOptional()
    @IsBoolean()
    enableNotifications?: boolean;

    @ApiProperty({ example: true, required: false })
    @IsOptional()
    @IsBoolean()
    enableAlerts?: boolean;

    // Alternative / legacy nodemailer field aliases (all optional)
    @ApiProperty({ example: 'smtp.gmail.com', required: false })
    @IsOptional()
    @IsString()
    host?: string;

    @ApiProperty({ example: 465, required: false })
    @IsOptional()
    port?: number;

    @ApiProperty({ example: 'user@gmail.com', required: false })
    @IsOptional()
    @IsString()
    user?: string;

    @ApiProperty({ example: 'password123', required: false })
    @IsOptional()
    @IsString()
    pass?: string;

    @ApiProperty({ example: true, required: false })
    @IsOptional()
    @IsBoolean()
    secure?: boolean;

    @ApiProperty({ example: 'noreply@company.com', required: false })
    @IsOptional()
    @IsEmail()
    fromEmail?: string;
}

export class CreateSettingDto {
    @ApiProperty({ description: 'ID of the user who owns this settings', example: 'uuid-of-user' })
    @IsUUID()
    userId: string;

    @ApiProperty({ description: 'ID of the company this settings belongs to', example: 'uuid-of-company' })
    @IsUUID()
    companyId: string;

    @ApiProperty({ description: 'SMTP configuration', type: SmtpConfigDto, required: false })
    @IsOptional()
    @ValidateNested()
    @Type(() => SmtpConfigDto)
    smtpConfig?: SmtpConfigDto;

    @ApiProperty({ description: 'Reminder frequency: normal / important / critical', example: 'normal', required: false })
    @IsOptional()
    @IsString()
    reminderFrequency?: string;

    @ApiProperty({ description: 'Calibration Junior/Engineer recipients', example: ['junior1@example.com'], required: false })
    @IsOptional()
    @IsArray()
    @IsEmail({}, { each: true })
    juniorRecipients?: string[];

    @ApiProperty({ description: 'Calibration Senior recipients', example: ['senior@example.com'], required: false })
    @IsOptional()
    @IsArray()
    @IsEmail({}, { each: true })
    seniorRecipients?: string[];

    @ApiProperty({ description: 'Supervisor recipients', example: ['supervisor@example.com'], required: false })
    @IsOptional()
    @IsArray()
    @IsEmail({}, { each: true })
    supervisorRecipients?: string[];

    @ApiProperty({ description: 'Theme settings', required: false })
    @IsOptional()
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

    @ApiProperty({ description: 'Report Format settings', required: false })
    @IsOptional()
    reportConfig?: {
        headerText: string;
        footerText: string;
    };

    @ApiProperty({ description: 'Certificate Number & ULR configuration', required: false })
    @IsOptional()
    certificateConfig?: {
        certPrefix: string;
        certSeparator: string;
        certYearFormat: string;
        certSeqLength: number;
        certNextSeq: number;
        certResetFrequency?: 'never' | 'monthly' | 'yearly' | 'financial_year' | 'custom';
        certCustomResetMonths?: number;
        certStartSeq?: number;
        certLastResetPeriod?: string;
        ulrPrefix: string;
        ulrSeparator: string;
        ulrYearFormat: string;
        ulrSeqLength: number;
        ulrNextSeq: number;
        ulrResetFrequency?: 'never' | 'monthly' | 'yearly' | 'financial_year' | 'custom';
        ulrCustomResetMonths?: number;
        ulrStartSeq?: number;
        ulrLastResetPeriod?: string;
        titleFontSize?: number;
        tableHeaderFontSize?: number;
        contentFontSize?: number;
        labelFontSize?: number;
        valueFontSize?: number;
        signatureFontSize?: number;
        signatureImageWidth?: number;
        signatureImageHeight?: number;
        tableGap?: number;
    };

    @ApiProperty({ description: 'Dashboard & warning display configuration', required: false })
    @IsOptional()
    dashboardConfig?: {
        warningDays?: number;
        widgets?: Record<string, boolean>;
    };

    @ApiProperty({ description: 'AI & Copilot Gateway configuration', required: false })
    @IsOptional()
    aiConfig?: {
        apiKey?: string;
        defaultModel?: string;
        enabled?: boolean;
    };

    @ApiProperty({ description: 'Days before due date to start sending due reminder emails', example: 15, required: false })
    @IsOptional()
    @IsNumber()
    dueReminderThresholdDays?: number;

    @ApiProperty({ description: 'Daily dispatch time in HH:mm format for location reminders', example: '09:00', required: false })
    @IsOptional()
    @IsString()
    reminderDispatchTime?: string;

    @ApiProperty({ description: 'Management summary report configuration', required: false })
    @IsOptional()
    summaryReportConfig?: {
        enabled: boolean;
        frequency: string;
        managementRecipients?: string[];
    };

    @ApiProperty({ description: 'Custom instrument status names for company', required: false, type: [String] })
    @IsOptional()
    customInstrumentStatuses?: string[];
}
