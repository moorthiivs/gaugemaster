import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RefreshTokenDto {
  @ApiProperty({ description: 'JWT Refresh Token' })
  @IsNotEmpty()
  @IsString()
  refreshToken: string;
}
