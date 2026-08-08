import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsIn, IsDateString } from 'class-validator';

export class UpdateCompanyAccessDto {
  @ApiProperty({ description: 'Access status', enum: ['enabled', 'disabled', 'time_limited'] })
  @IsString()
  @IsIn(['enabled', 'disabled', 'time_limited'])
  accessStatus: string;

  @ApiProperty({ description: 'Access start date (ISO string)', required: false })
  @IsOptional()
  @IsDateString()
  accessStartDate?: string;

  @ApiProperty({ description: 'Access expiry date (ISO string)', required: false })
  @IsOptional()
  @IsDateString()
  accessExpiryDate?: string;
}

export class UpdateCompanyDto {
  @ApiProperty({ description: 'Company name', required: false })
  @IsOptional()
  @IsString()
  companyName?: string;

  @ApiProperty({ description: 'Industry', required: false })
  @IsOptional()
  @IsString()
  industry?: string;

  @ApiProperty({ description: 'Company size', required: false })
  @IsOptional()
  @IsString()
  companySize?: string;
}

export class DeleteCompanyDto {
  @ApiProperty({ description: 'Company name typed for confirmation' })
  @IsString()
  confirmationName: string;
}
