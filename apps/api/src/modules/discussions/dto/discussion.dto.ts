import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreatePostDto {
  @ApiProperty({ description: 'Markdown; fenced code blocks are rendered' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(10_000)
  content!: string;

  @ApiPropertyOptional({ description: 'Set to reply to an existing post' })
  @IsString()
  @IsOptional()
  parentId?: string;
}

export class UpdatePostDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(10_000)
  content?: string;

  @ApiPropertyOptional({ description: 'Teacher/admin only — pins the thread to the top' })
  @IsBoolean()
  @IsOptional()
  isPinned?: boolean;
}
