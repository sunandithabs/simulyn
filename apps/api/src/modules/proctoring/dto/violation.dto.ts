import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ViolationType } from '@simulyn/shared';
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class RecordViolationDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  examAttemptId!: string;

  @ApiProperty({ enum: ViolationType })
  @IsEnum(ViolationType)
  typeKey!: ViolationType;

  @ApiPropertyOptional({ description: 'Defaults to the catalogue weight for this violation type' })
  @IsInt()
  @Min(0)
  @Max(100)
  @IsOptional()
  weight?: number;

  @ApiPropertyOptional({ description: 'Editor contents at the moment of the violation' })
  @IsString()
  @IsOptional()
  @MaxLength(100_000)
  codeSnapshot?: string;

  @ApiPropertyOptional({ description: 'Seconds left on the exam timer' })
  @IsInt()
  @IsOptional()
  timeRemaining?: number;

  @ApiPropertyOptional({ description: 'Free-form JSON string' })
  @IsString()
  @IsOptional()
  @MaxLength(4000)
  metadata?: string;
}

export class FlagAttemptDto {
  @ApiProperty({ description: 'What the proctor observed' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  note!: string;
}

export class TerminateAttemptDto {
  @ApiProperty({ description: 'Why the student is being removed — shown to them and logged' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reason!: string;
}

export class QueryViolationsDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  examId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  userId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  examAttemptId?: string;

  @ApiPropertyOptional({ enum: ViolationType })
  @IsEnum(ViolationType)
  @IsOptional()
  typeKey?: ViolationType;
}
