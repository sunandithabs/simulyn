import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({ example: 'student1' })
  @IsString()
  @IsNotEmpty()
  oldPassword!: string;

  @ApiProperty({ example: 'my-new-password', minLength: 6 })
  @IsString()
  @MinLength(6)
  @MaxLength(200)
  newPassword!: string;
}
