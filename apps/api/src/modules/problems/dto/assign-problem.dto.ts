import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class AssignProblemDto {
  @ApiProperty({ description: 'Problem to assign to the class' })
  @IsString()
  @IsNotEmpty()
  problemId!: string;

  @ApiPropertyOptional({ example: '2026-09-01T23:59:00.000Z' })
  @IsDateString()
  @IsOptional()
  dueDate?: string;
}
