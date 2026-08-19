import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsNotEmpty, IsString, Matches } from 'class-validator';

export class EnrollStudentsDto {
  @ApiProperty({ type: [String], description: 'User ids to enroll' })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @IsString({ each: true })
  userIds!: string[];
}

export class JoinClassDto {
  @ApiProperty({ example: 'CSE2026A', description: 'Class join code (case-insensitive)' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Za-z0-9]{4,12}$/, { message: 'code must be 4-12 alphanumeric characters' })
  code!: string;
}
