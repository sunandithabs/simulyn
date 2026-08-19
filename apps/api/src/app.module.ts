import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { join } from 'node:path';

import configuration from './config/configuration';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { UserThrottlerGuard } from './common/guards/user-throttler.guard';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { PrismaModule } from './prisma/prisma.module';
import { AdminModule } from './modules/admin/admin.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { ResearchModule } from './modules/research/research.module';
import { AuthModule } from './modules/auth/auth.module';
import { ClassesModule } from './modules/classes/classes.module';
import { DiscussionsModule } from './modules/discussions/discussions.module';
import { ExamsModule } from './modules/exams/exams.module';
import { ExecutionModule } from './modules/execution/execution.module';
import { GamificationModule } from './modules/gamification/gamification.module';
import { MentorModule } from './modules/mentor/mentor.module';
import { ProblemsModule } from './modules/problems/problems.module';
import { ProctoringModule } from './modules/proctoring/proctoring.module';
import { SubmissionsModule } from './modules/submissions/submissions.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      // apps/api/.env wins; the repo-root .env is the fallback.
      envFilePath: ['.env', join(__dirname, '..', '.env'), join(__dirname, '..', '..', '..', '.env')],
    }),
    // Generous default; execution, submissions and mentor routes tighten it.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 300 }]),
    PrismaModule,
    AuthModule,
    UsersModule,
    ClassesModule,
    ProblemsModule,
    ExecutionModule,
    GamificationModule,
    SubmissionsModule,
    ExamsModule,
    ProctoringModule,
    MentorModule,
    AnalyticsModule,
    ResearchModule,
    DiscussionsModule,
    AdminModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    // Registered last so request.user is already populated for per-user buckets.
    { provide: APP_GUARD, useClass: UserThrottlerGuard },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
  ],
})
export class AppModule {}
