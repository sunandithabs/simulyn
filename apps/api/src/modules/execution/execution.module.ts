import { Module } from '@nestjs/common';
import { ElectronicsController, ExecutionController } from './execution.controller';
import { ExecutionService } from './execution.service';

@Module({
  controllers: [ExecutionController, ElectronicsController],
  providers: [ExecutionService],
  exports: [ExecutionService],
})
export class ExecutionModule {}
