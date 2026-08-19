import { Module } from '@nestjs/common';
import { ExecutionModule } from '../execution/execution.module';
import { GamificationModule } from '../gamification/gamification.module';
import { ProblemSubmissionsController, SubmissionsController } from './submissions.controller';
import { SubmissionsService } from './submissions.service';

@Module({
  imports: [ExecutionModule, GamificationModule],
  controllers: [SubmissionsController, ProblemSubmissionsController],
  providers: [SubmissionsService],
  exports: [SubmissionsService],
})
export class SubmissionsModule {}
