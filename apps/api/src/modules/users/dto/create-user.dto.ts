import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@simulyn/shared';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ example: 'new.student' })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(40)
  @Matches(/^[a-zA-Z0-9._-]+$/, {
    message: 'username may only contain letters, digits, dots, underscores and hyphens',
  })
  username!: string;

  @ApiProperty({ example: 'new.student@simulyn.edu' })
  @IsEmail()
  @MaxLength(160)
  email!: string;

  @ApiProperty({ example: 'New Student' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  displayName!: string;

  @ApiProperty({ example: 'welcome123', minLength: 6 })
  @IsString()
  @MinLength(6)
  @MaxLength(200)
  password!: string;

  @ApiPropertyOptional({ enum: Role, default: Role.STUDENT })
  @IsEnum(Role)
  @IsOptional()
  role?: Role;

  @ApiPropertyOptional({ description: 'Avatar URL or emoji' })
  @IsString()
  @IsOptional()
  @MaxLength(300)
  avatar?: string;

  @ApiPropertyOptional({
    default: true,
    description: 'Force a password change on first sign-in',
  })
  @IsBoolean()
  @IsOptional()
  mustChangePassword?: boolean;
}
