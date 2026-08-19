import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SubmissionsModule } from '../submissions/submissions.module';
import { ProctoringController } from './proctoring.controller';
import { ProctoringGateway } from './proctoring.gateway';
import { ProctoringService } from './proctoring.service';

@Module({
  // SubmissionsModule scores an attempt when a student is removed mid-exam.
  imports: [AuthModule, SubmissionsModule],
  controllers: [ProctoringController],
  providers: [ProctoringService, ProctoringGateway],
  exports: [ProctoringService, ProctoringGateway],
})
export class ProctoringModule {}
