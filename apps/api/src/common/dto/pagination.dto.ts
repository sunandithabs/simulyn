import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class PaginationDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit: number = 20;

  @ApiPropertyOptional({ description: 'Field to sort by' })
  @IsString()
  @IsOptional()
  sortBy?: string;

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsIn(['asc', 'desc'])
  @IsOptional()
  order: 'asc' | 'desc' = 'desc';

  get skip(): number {
    return (this.page - 1) * this.limit;
  }
}

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export function paginated<T>(data: T[], total: number, dto: PaginationDto): PaginatedResult<T> {
  return {
    data,
    meta: {
      total,
      page: dto.page,
      limit: dto.limit,
      totalPages: Math.max(1, Math.ceil(total / dto.limit)),
    },
  };
}

/**
 * Builds a Prisma `orderBy` from the DTO, restricted to an allow-list so a
 * client cannot sort by an arbitrary column.
 */
export function orderByFrom(
  dto: PaginationDto,
  allowed: readonly string[],
  fallback: string,
): Record<string, 'asc' | 'desc'> {
  const field = dto.sortBy && allowed.includes(dto.sortBy) ? dto.sortBy : fallback;
  return { [field]: dto.order };
}
