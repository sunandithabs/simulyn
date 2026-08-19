import { Module } from '@nestjs/common';
import { ClassProblemsController } from './class-problems.controller';
import { ProblemsController } from './problems.controller';
import { ProblemsService } from './problems.service';

@Module({
  controllers: [ProblemsController, ClassProblemsController],
  providers: [ProblemsService],
  exports: [ProblemsService],
})
export class ProblemsModule {}
