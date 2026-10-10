import { Module } from '@nestjs/common';

import { ResearchController } from './research.controller';
import { ResearchInsightsService } from './research-insights.service';
import { ResearchService } from './research.service';

@Module({
  controllers: [ResearchController],
  providers: [ResearchService, ResearchInsightsService],
})
export class ResearchModule {}
