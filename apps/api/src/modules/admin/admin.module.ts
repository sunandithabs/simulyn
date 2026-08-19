import { Module } from '@nestjs/common';
import { ExecutionModule } from '../execution/execution.module';
import { ProctoringModule } from '../proctoring/proctoring.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [ExecutionModule, ProctoringModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
