import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Language } from '@simulyn/shared';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

import { PaginationDto } from '../../../common/dto/pagination.dto';
import { MAX_CODE_LENGTH } from '../../execution/executor';

export class CreateSubmissionDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  problemId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_CODE_LENGTH)
  code!: string;

  @ApiProperty({ enum: Language })
  @IsEnum(Language)
  language!: Language;

  @ApiPropertyOptional({ description: 'Set when the submission is part of an exam attempt' })
  @IsString()
  @IsOptional()
  examAttemptId?: string;
}

export class QuerySubmissionsDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  problemId?: string;

  @ApiPropertyOptional({ enum: Language })
  @IsEnum(Language)
  @IsOptional()
  language?: Language;

  @ApiPropertyOptional()
  @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value))
  @IsBoolean()
  @IsOptional()
  passed?: boolean;

  @ApiPropertyOptional({ description: 'Teacher/admin only — defaults to your own submissions' })
  @IsString()
  @IsOptional()
  userId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  examAttemptId?: string;
}
