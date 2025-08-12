import { IsEmail, IsNotEmpty, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateUserDto {
    @ApiProperty({ example: 'Moorthi', description: 'Full name of the user' })
    @IsNotEmpty()
    name: string;

    @ApiProperty({ example: 'moorthi@example.com', description: 'Valid email address' })
    @IsEmail()
    email: string;

    @ApiProperty({ example: 'secret123', description: 'Password with at least 6 characters' })
    @MinLength(6)
    password: string;
}
