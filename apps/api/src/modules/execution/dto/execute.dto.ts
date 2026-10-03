import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LANGUAGE_KEYS } from '@simulyn/shared';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDefined,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

import { MAX_CODE_LENGTH } from '../executor';

export class RunCodeDto {
  @ApiProperty({ description: 'Source code to execute as-is' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_CODE_LENGTH)
  code!: string;

  @ApiProperty({ enum: LANGUAGE_KEYS, example: 'python' })
  @IsIn(LANGUAGE_KEYS as unknown as string[])
  lang!: 'python' | 'javascript' | 'cpp' | 'java';

  @ApiPropertyOptional({ description: 'Piped to the program on stdin' })
  @IsString()
  @IsOptional()
  @MaxLength(100_000)
  stdin?: string;

  @ApiPropertyOptional({ description: 'Run through this problem’s harness so main is supplied' })
  @IsString()
  @IsOptional()
  problemId?: string;
}

export class SubmitCodeDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_CODE_LENGTH)
  code!: string;

  @ApiProperty({ enum: LANGUAGE_KEYS, example: 'python' })
  @IsIn(LANGUAGE_KEYS as unknown as string[])
  lang!: 'python' | 'javascript' | 'cpp' | 'java';

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  problemId!: string;

  @ApiPropertyOptional({ description: 'Run only the visible sample cases (the Run button)' })
  @IsBoolean()
  @IsOptional()
  visibleOnly?: boolean;
}

export class TraceCodeDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_CODE_LENGTH)
  code!: string;

  @ApiProperty({ enum: LANGUAGE_KEYS, example: 'python' })
  @IsIn(LANGUAGE_KEYS as unknown as string[])
  lang!: 'python' | 'javascript' | 'cpp' | 'java';

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  problemId!: string;

  @ApiPropertyOptional({
    default: 0,
    description: 'Which visible test case to trace. Hidden cases cannot be traced.',
  })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  testCaseIndex?: number;

  @ApiPropertyOptional({
    default: 0,
    description: 'Number of steps to skip, for paging through a long run.',
  })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100_000)
  @IsOptional()
  offset?: number;
}

export class ElectronicsAnswerDto {
  @ApiProperty({ example: 'vout' })
  @IsString()
  @IsNotEmpty()
  questionId!: string;

  // @IsDefined is required: the global ValidationPipe runs with whitelist:true,
  // which strips any property that carries no validation decorator.
  @ApiProperty({ example: '8', description: 'Numeric answer; strings are coerced' })
  @IsDefined()
  value!: number | string;
}

export class ElectronicsSubmitDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  problemId!: string;

  @ApiProperty({ type: [ElectronicsAnswerDto] })
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => ElectronicsAnswerDto)
  answers!: ElectronicsAnswerDto[];
}
