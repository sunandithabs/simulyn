import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'admin', description: 'Username or email address' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  username!: string;

  @ApiProperty({ example: 'admin123' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  password!: string;
}
