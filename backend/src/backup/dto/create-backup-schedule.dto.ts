import { IsOptional, IsString, IsBoolean, IsInt, Min, Max, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateBackupScheduleDto {
    @ApiProperty()
    @IsString()
    companyId: string;

    @ApiPropertyOptional({ default: true })
    @IsOptional()
    @IsBoolean()
    enabled?: boolean;

    @ApiProperty({ enum: ['daily', 'weekly', 'monthly'] })
    @IsIn(['daily', 'weekly', 'monthly'])
    frequency: string;

    @ApiPropertyOptional({ default: '02:00', description: 'Time in HH:mm 24h format' })
    @IsOptional()
    @IsString()
    timeOfDay?: string;

    @ApiPropertyOptional({ description: '0=Sun..6=Sat, required for weekly' })
    @IsOptional()
    @IsInt()
    @Min(0)
    @Max(6)
    dayOfWeek?: number;

    @ApiPropertyOptional({ description: '1..28, required for monthly' })
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(28)
    dayOfMonth?: number;

    @ApiPropertyOptional({ default: 7, description: 'Auto-delete backups older than N days' })
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(365)
    retentionDays?: number;

    @ApiPropertyOptional({ default: 'local', enum: ['local', 'google_drive'] })
    @IsOptional()
    @IsIn(['local', 'google_drive'])
    storageType?: string;
}
