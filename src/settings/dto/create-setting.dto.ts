import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsEmail, IsUUID, IsArray, ValidateNested, IsBoolean, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

class SmtpConfigDto {
    @ApiProperty({ example: 'smtp.gmail.com' })
    @IsString()
    host: string;

    @ApiProperty({ example: 465 })
    @IsNumber()
    port: number;

    @ApiProperty({ example: 'user@gmail.com' })
    @IsString()
    user: string;

    @ApiProperty({ example: 'password123' })
    @IsString()
    pass: string;

    @ApiProperty({ example: true })
    @IsBoolean()
    secure: boolean;

    @ApiProperty({ example: 'noreply@company.com' })
    @IsEmail()
    fromEmail: string;
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
}
