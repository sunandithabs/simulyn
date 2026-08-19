import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@simulyn/shared';

export class AuthUserDto {
  @ApiProperty() id!: string;
  @ApiProperty() username!: string;
  @ApiProperty() email!: string;
  @ApiProperty() displayName!: string;
  @ApiProperty({ nullable: true, type: String }) avatar!: string | null;
  @ApiProperty({ enum: Role }) role!: Role;
  @ApiProperty() mustChangePassword!: boolean;
}

export class AuthResponseDto {
  @ApiProperty({ description: 'JWT access token, valid for 15 minutes' })
  accessToken!: string;

  @ApiProperty({ type: AuthUserDto })
  user!: AuthUserDto;
}
