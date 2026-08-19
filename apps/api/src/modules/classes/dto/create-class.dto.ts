import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateClassDto {
  @ApiProperty({ example: 'CSE 2027 Batch B' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ example: 'Algorithms lab for the 2027 batch.' })
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({ example: 'Odd 2027' })
  @IsString()
  @IsOptional()
  @MaxLength(60)
  semester?: string;

  @ApiPropertyOptional({
    description: 'Teacher who owns the class. Admin only — defaults to the caller.',
  })
  @IsString()
  @IsOptional()
  teacherId?: string;
}
