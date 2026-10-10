import { Module } from '@nestjs/common';
import { MentorModule } from '../mentor/mentor.module';
import { AnalyticsController } from './analytics.controller';
import { StudentReportController } from './student-report.controller';
import { AnalyticsService } from './analytics.service';

@Module({
  imports: [MentorModule],
  controllers: [AnalyticsController, StudentReportController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
