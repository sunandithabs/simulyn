import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@simulyn/shared';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class BulkUserDto {
  @ApiProperty({ example: 'student.one' })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(40)
  @Matches(/^[a-zA-Z0-9._-]+$/)
  username!: string;

  @ApiProperty({ example: 'student.one@simulyn.edu' })
  @IsEmail()
  @MaxLength(160)
  email!: string;

  @ApiProperty({ example: 'Student One' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  displayName!: string;

  @ApiProperty({ example: 'welcome123', minLength: 6 })
  @IsString()
  @MinLength(6)
  @MaxLength(200)
  password!: string;
}

export class BulkCreateUsersDto {
  @ApiProperty({ type: [BulkUserDto], description: 'Up to 500 accounts per request' })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => BulkUserDto)
  users!: BulkUserDto[];

  @ApiPropertyOptional({ enum: Role, default: Role.STUDENT, description: 'Role applied to every row' })
  @IsEnum(Role)
  @IsOptional()
  role?: Role;

  @ApiPropertyOptional({ description: 'Enroll every created user into this class' })
  @IsString()
  @IsOptional()
  classId?: string;
}

export class BulkCreateResultDto {
  @ApiProperty() created!: number;
  @ApiProperty() failed!: number;
  @ApiProperty({ type: [String] }) createdUsernames!: string[];
  @ApiProperty({
    type: 'array',
    items: { type: 'object', properties: { username: { type: 'string' }, reason: { type: 'string' } } },
  })
  failures!: { username: string; reason: string }[];
}
