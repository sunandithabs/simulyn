import { ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@simulyn/shared';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateUserDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(120)
  displayName?: string;

  @ApiPropertyOptional()
  @IsEmail()
  @IsOptional()
  @MaxLength(160)
  email?: string;

  @ApiPropertyOptional({ description: 'Avatar URL or emoji' })
  @IsString()
  @IsOptional()
  @MaxLength(300)
  avatar?: string;

  @ApiPropertyOptional({ enum: Role, description: 'Admin only' })
  @IsEnum(Role)
  @IsOptional()
  role?: Role;

  @ApiPropertyOptional({ description: 'Admin only' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Admin only — resets the password' })
  @IsString()
  @IsOptional()
  @MinLength(6)
  @MaxLength(200)
  password?: string;

  @ApiPropertyOptional({ description: 'Admin only' })
  @IsBoolean()
  @IsOptional()
  mustChangePassword?: boolean;
}

/** Fields a non-admin is allowed to change on their own account. */
export const SELF_EDITABLE_FIELDS = ['displayName', 'email', 'avatar'] as const;
