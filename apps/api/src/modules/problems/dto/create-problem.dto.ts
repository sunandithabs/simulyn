import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Difficulty, ProblemType } from '@simulyn/shared';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class TestCaseDto {
  @ApiProperty({ description: 'One JSON literal per line, in harness param order' })
  @IsString()
  input!: string;

  @ApiProperty({ description: 'A single JSON literal matching the harness return type' })
  @IsString()
  expected!: string;

  @ApiPropertyOptional({ default: false, description: 'Hidden cases are never shown to students' })
  @IsBoolean()
  @IsOptional()
  isHidden?: boolean;

  @ApiPropertyOptional({ default: 0 })
  @IsInt()
  @IsOptional()
  order?: number;
}

export class HintDto {
  @ApiProperty({ minimum: 1, maximum: 5, description: '1 = gentle nudge, 3 = near-solution' })
  @IsInt()
  @Min(1)
  @Max(5)
  level!: number;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  text!: string;
}

export class ExampleDto {
  @ApiProperty() @IsString() input!: string;
  @ApiProperty() @IsString() output!: string;
  @ApiPropertyOptional() @IsString() @IsOptional() explanation?: string;
}

export class HarnessParamDto {
  @ApiProperty() @IsString() name!: string;

  @ApiProperty({
    enum: ['int', 'double', 'string', 'bool', 'intArray', 'stringArray', 'listNode', 'treeNode', 'grid'],
  })
  @IsString()
  type!: string;
}

export class HarnessDto {
  @ApiProperty({ example: 'twoSum' })
  @IsString()
  @IsNotEmpty()
  funcName!: string;

  @ApiProperty({ type: [HarnessParamDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HarnessParamDto)
  params!: HarnessParamDto[];

  @ApiProperty({ example: 'intArray' })
  @IsString()
  returnType!: string;

  @ApiPropertyOptional({ enum: ['sortArray', 'sortRows'], description: 'Canonicalise output before comparing' })
  @IsString()
  @IsOptional()
  normalize?: 'sortArray' | 'sortRows';
}

export class ElectronicsQuestionDto {
  @ApiProperty({ example: 'vout' })
  @IsString()
  @IsNotEmpty()
  id!: string;

  @ApiProperty({ example: 'What is the output voltage across R2?' })
  @IsString()
  @IsNotEmpty()
  text!: string;

  @ApiProperty({ example: 8 })
  @IsNumber()
  answer!: number;

  @ApiProperty({ example: 0.05, description: 'Absolute tolerance in the answer unit' })
  @IsNumber()
  @Min(0)
  tolerance!: number;

  @ApiPropertyOptional({ example: 'V' })
  @IsString()
  @IsOptional()
  unit?: string;
}

export class CreateProblemDto {
  @ApiProperty({ enum: ProblemType })
  @IsEnum(ProblemType)
  type!: ProblemType;

  @ApiProperty({ enum: Difficulty })
  @IsEnum(Difficulty)
  difficulty!: Difficulty;

  @ApiProperty({ example: 'Arrays' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  category!: string;

  @ApiProperty({ example: 'Two Sum' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  title!: string;

  @ApiProperty({ description: 'Markdown' })
  @IsString()
  @IsNotEmpty()
  description!: string;

  @ApiPropertyOptional({ type: [String], default: [] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  constraints?: string[];

  @ApiPropertyOptional({ default: 100 })
  @IsInt()
  @Min(0)
  @Max(10000)
  @IsOptional()
  points?: number;

  @ApiPropertyOptional({ type: [String], default: [] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @IsOptional()
  isPublished?: boolean;

  // ── programming ──
  @ApiPropertyOptional({
    description: 'Per-language starter stubs, e.g. { "python": "def twoSum(...)" }',
    type: 'object',
    additionalProperties: { type: 'string' },
  })
  @IsObject()
  @IsOptional()
  starterCode?: Record<string, string>;

  @ApiPropertyOptional({ type: HarnessDto })
  @ValidateNested()
  @Type(() => HarnessDto)
  @IsOptional()
  harness?: HarnessDto;

  @ApiPropertyOptional({ type: [ExampleDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExampleDto)
  @IsOptional()
  examples?: ExampleDto[];

  @ApiPropertyOptional({ type: [TestCaseDto] })
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => TestCaseDto)
  @IsOptional()
  testCases?: TestCaseDto[];

  // ── electronics ──
  @ApiPropertyOptional({
    description: 'Circuit parameters, e.g. { "supply": 12, "R1": 10000 }',
    type: 'object',
    additionalProperties: true,
  })
  @IsObject()
  @IsOptional()
  params?: Record<string, unknown>;

  @ApiPropertyOptional({ type: [ElectronicsQuestionDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ElectronicsQuestionDto)
  @IsOptional()
  questions?: ElectronicsQuestionDto[];

  // ── shared ──
  @ApiPropertyOptional({ type: [HintDto] })
  @IsArray()
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => HintDto)
  @IsOptional()
  hints?: HintDto[];
}
