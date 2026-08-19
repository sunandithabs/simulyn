import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Language } from '@simulyn/shared';
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class MentorHintDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  problemId!: string;

  @ApiProperty({ enum: Language })
  @IsEnum(Language)
  language!: Language;

  @ApiProperty({ minimum: 1, maximum: 3, description: '1 = gentle nudge, 3 = near-solution approach' })
  @IsInt()
  @Min(1)
  @Max(3)
  hintLevel!: number;

  @ApiProperty({ description: 'The student’s current code' })
  @IsString()
  @MaxLength(60_000)
  code!: string;

  @ApiPropertyOptional({ description: 'Optional question from the student' })
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  question?: string;
}
