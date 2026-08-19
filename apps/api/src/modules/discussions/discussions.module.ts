import { Module } from '@nestjs/common';
import { DiscussionsController, ProblemDiscussionsController } from './discussions.controller';
import { DiscussionsService } from './discussions.service';

@Module({
  controllers: [ProblemDiscussionsController, DiscussionsController],
  providers: [DiscussionsService],
  exports: [DiscussionsService],
})
export class DiscussionsModule {}
