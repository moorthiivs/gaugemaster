import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsUUID, IsEmail, IsArray } from 'class-validator';

export class UpsertLocationEmailDto {
  @ApiProperty({ description: 'Mapping UUID if updating', example: '3f5897f4-e809-4e3a-b70e-21e7911133a5', required: false })
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiProperty({ description: 'Company UUID', example: '8e3c597c-cd93-47db-a903-076276192e4d', required: false })
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @ApiProperty({ description: 'Location Name', example: 'Plant 1', required: true })
  @IsNotEmpty()
  @IsString()
  location: string;

  @ApiProperty({ description: 'Location Head Name', example: 'John Doe', required: false })
  @IsOptional()
  @IsString()
  headName?: string;

  @ApiProperty({ description: 'Location Head Email', example: 'head@example.com', required: true })
  @IsNotEmpty()
  @IsEmail({}, { message: 'Head email must be a valid email address' })
  headEmail: string;

  @ApiProperty({ description: 'Management notification email recipients', example: ['mgr1@example.com', 'mgr2@example.com'], required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsEmail({}, { each: true, message: 'Each management email must be a valid email address' })
  managementEmails?: string[];
}
