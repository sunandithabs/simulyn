import { ApiPropertyOptional } from '@nestjs/swagger';
import { Difficulty, ProblemType } from '@simulyn/shared';
import { Transform } from 'class-transformer';
import { IsArray, IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class QueryProblemsDto extends PaginationDto {
  @ApiPropertyOptional({ enum: ProblemType })
  @IsEnum(ProblemType)
  @IsOptional()
  type?: ProblemType;

  @ApiPropertyOptional({ enum: Difficulty })
  @IsEnum(Difficulty)
  @IsOptional()
  difficulty?: Difficulty;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  category?: string;

  @ApiPropertyOptional({
    description: 'Comma-separated list — a problem matches when it carries every listed tag',
    example: 'array,hash-table',
  })
  @Transform(({ value }) =>
    typeof value === 'string'
      ? value.split(',').map((t) => t.trim()).filter(Boolean)
      : value,
  )
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @ApiPropertyOptional({ description: 'Matches the title' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ description: 'Teacher/admin only — students always see published problems' })
  @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value))
  @IsBoolean()
  @IsOptional()
  isPublished?: boolean;
}
