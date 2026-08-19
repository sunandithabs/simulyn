import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Role } from '@simulyn/shared';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import {
  ElectronicsSubmitDto,
  RunCodeDto,
  SubmitCodeDto,
  TraceCodeDto,
} from './dto/execute.dto';
import { ExecutionService } from './execution.service';

@ApiTags('execution')
@ApiBearerAuth()
@Controller('execute')
export class ExecutionController {
  constructor(private readonly execution: ExecutionService) {}

  @Post('run')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Run code as-is with optional stdin',
    description: 'Rate limited to 30 requests per minute per user.',
  })
  async run(@Body() dto: RunCodeDto) {
    const result = await this.execution.run(dto.lang, dto.code, dto.stdin ?? '');
    return {
      ok: result.compileError === null && !result.timedOut && result.exitCode === 0,
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
      timedOut: result.timedOut,
      compileError: result.compileError,
      executionMs: result.executionMs,
    };
  }

  @Post('submit')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Run code against a problem’s test cases without recording a submission',
    description: 'Students receive hidden cases as pass/fail only — never their input or expected output.',
  })
  async submit(@Body() dto: SubmitCodeDto, @CurrentUser() user: AuthenticatedUser) {
    const result = await this.execution.evaluateProblem(dto.problemId, dto.code, dto.lang);
    return user.role === Role.STUDENT ? this.execution.maskHidden(result) : result;
  }

  @Post('trace')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Run one visible test case through a self-narrating driver',
    description:
      'Returns the trace the visualiser replays. Python is traced line by line; JavaScript reports array reads and writes; C++ and Java report only what the solution emits itself.',
  })
  trace(@Body() dto: TraceCodeDto) {
    return this.execution.runWithTrace(dto.problemId, dto.code, dto.lang, dto.testCaseIndex ?? 0);
  }

  @Get('health')
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: 'Which language runtimes this server can execute, plus live queue depth' })
  health() {
    return this.execution.health();
  }
}

@ApiTags('execution')
@ApiBearerAuth()
@Controller('electronics')
export class ElectronicsController {
  constructor(private readonly execution: ExecutionService) {}

  @Post('submit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Check electronics answers against the answer key, within tolerance' })
  validate(@Body() dto: ElectronicsSubmitDto) {
    return this.execution.validateElectronics(dto.problemId, dto.answers);
  }
}
