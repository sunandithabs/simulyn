import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsObject,
  ValidateNested,
  IsBoolean,
  IsIn,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CriterionDto {
  @IsString() @IsNotEmpty() @MaxLength(40)
  name!: string;

  @Type(() => Number) @IsInt() @Min(1) @Max(100)
  max!: number;
}

export class CreateHackathonDto {
  @IsString() @IsNotEmpty() @MaxLength(120)
  title!: string;

  @IsString() @IsNotEmpty() @MaxLength(5000)
  description!: string;

  @IsOptional() @IsString() @MaxLength(5000)
  rules?: string;

  @IsDateString()
  startsAt!: string;

  @IsDateString()
  endsAt!: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(10)
  maxTeamSize?: number;

  @IsOptional() @IsArray() @ArrayMaxSize(8) @ValidateNested({ each: true }) @Type(() => CriterionDto)
  criteria?: CriterionDto[];

  @IsOptional() @IsIn(['PROJECT', 'PROBLEMS'])
  mode?: 'PROJECT' | 'PROBLEMS';

  @IsOptional() @IsArray() @ArrayMaxSize(30) @IsString({ each: true })
  problemIds?: string[];
}

export class UpdateHackathonDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(120)
  title?: string;

  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(5000)
  description?: string;

  @IsOptional() @IsString() @MaxLength(5000)
  rules?: string;

  @IsOptional() @IsDateString()
  startsAt?: string;

  @IsOptional() @IsDateString()
  endsAt?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(10)
  maxTeamSize?: number;

  @IsOptional() @IsArray() @ArrayMaxSize(8) @ValidateNested({ each: true }) @Type(() => CriterionDto)
  criteria?: CriterionDto[];

  @IsOptional() @IsIn(['PROJECT', 'PROBLEMS'])
  mode?: 'PROJECT' | 'PROBLEMS';

  @IsOptional() @IsArray() @ArrayMaxSize(30) @IsString({ each: true })
  problemIds?: string[];

  @IsOptional() @IsBoolean()
  isPublished?: boolean;

  @IsOptional() @IsBoolean()
  resultsPublished?: boolean;
}

export class CreateTeamDto {
  @IsString() @IsNotEmpty() @MaxLength(60)
  name!: string;
}

export class JoinTeamDto {
  @IsString() @IsNotEmpty() @MaxLength(20)
  code!: string;
}

export class SubmissionDto {
  @IsString() @IsNotEmpty() @MaxLength(120)
  title!: string;

  @IsString() @IsNotEmpty() @MaxLength(5000)
  description!: string;

  @IsOptional() @IsUrl({ protocols: ['http', 'https'], require_protocol: true }) @MaxLength(300)
  repoUrl?: string;

  @IsOptional() @IsUrl({ protocols: ['http', 'https'], require_protocol: true }) @MaxLength(300)
  demoUrl?: string;
}

export class ScoreDto {
  /** Whole-number 0-100 score; used when the hackathon has no criteria. */
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100)
  score?: number;

  /** Points per criterion name; required when the hackathon has criteria. */
  @IsOptional() @IsObject()
  breakdown?: Record<string, number>;

  @IsOptional() @IsString() @MaxLength(2000)
  comment?: string;
}

export class InviteDto {
  @IsString() @IsNotEmpty() @MaxLength(60)
  username!: string;
}
