import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@simulyn/shared';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * Self-service registration payload. Account creation is normally done by an
 * admin (POST /users) — this DTO backs the same validation rules.
 */
export class RegisterDto {
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

  @ApiProperty({ example: 'temporary-password', minLength: 6 })
  @IsString()
  @MinLength(6)
  @MaxLength(200)
  password!: string;

  @ApiPropertyOptional({ enum: Role, default: Role.STUDENT })
  @IsEnum(Role)
  @IsOptional()
  role?: Role;
}
