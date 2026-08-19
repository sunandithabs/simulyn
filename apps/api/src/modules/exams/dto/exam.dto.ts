import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class ExamProblemDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  problemId!: string;

  @ApiPropertyOptional({ description: 'Overrides the problem’s own point value for this exam' })
  @IsInt()
  @Min(0)
  @Max(10_000)
  @IsOptional()
  points?: number;
}

export class CreateExamDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  classId!: string;

  @ApiProperty({ example: 'Mid-semester Practical' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  title!: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({ example: 90, description: 'Minutes each student gets once they start' })
  @IsInt()
  @Min(1)
  @Max(1440)
  durationMin!: number;

  @ApiProperty({ example: '2026-09-01T09:00:00.000Z' })
  @IsDateString()
  scheduledStart!: string;

  @ApiProperty({ example: '2026-09-01T12:00:00.000Z' })
  @IsDateString()
  scheduledEnd!: string;

  @ApiPropertyOptional({ default: 5 })
  @IsInt()
  @Min(0)
  @Max(120)
  @IsOptional()
  gracePeriodMin?: number;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  randomizeOrder?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @IsOptional()
  isPublished?: boolean;

  @ApiProperty({
    type: [ExamProblemDto],
    description: 'Problems in presentation order (before per-student shuffling)',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => ExamProblemDto)
  problems!: ExamProblemDto[];
}

export class UpdateExamDto extends PartialType(CreateExamDto) {}

export class SubmitExamDto {
  @ApiPropertyOptional({ default: false, description: 'Set by the client when the timer ran out' })
  @IsBoolean()
  @IsOptional()
  autoSubmitted?: boolean;
}
