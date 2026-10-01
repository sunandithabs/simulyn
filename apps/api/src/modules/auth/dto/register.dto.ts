import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * Public self-registration payload. Deliberately has no `role`: public
 * sign-ups are always STUDENT, and the global ValidationPipe
 * (forbidNonWhitelisted) rejects any extra field such as `role`.
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

  @ApiProperty({ example: 'choose-a-password', minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(200)
  password!: string;
}
