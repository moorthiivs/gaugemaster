import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsEmail, IsUUID } from 'class-validator';

export class CreateCompanyDto {
    @ApiProperty({
        description: 'The name of the company',
        example: 'Acme Industries',
    })
    @IsString()
    companyName: string;

    @ApiProperty({
        description: 'Company size (e.g., 0-10 employees, 11-50 employees)',
        example: '0-10 employees',
        required: false,
    })
    @IsOptional()
    @IsString()
    companySize?: string;

    @ApiProperty({
        description: 'Industry type (e.g., Manufacturing, Healthcare)',
        example: 'Manufacturing',
        required: false,
    })
    @IsOptional()
    @IsString()
    industry?: string;

    @ApiProperty({
        description: 'ID of the user registering this company',
        example: 'uuid-of-user',
    })
    @IsUUID()
    registeredUserId: string;

    @ApiProperty({
        description: 'Email of the user registering this company',
        example: 'admin@acme.com',
    })
    @IsEmail()
    registeredEmail: string;

    @ApiProperty({
        description: 'Role of the registered user in the company',
        example: 'Admin',
    })
    @IsString()
    role: string;
}
