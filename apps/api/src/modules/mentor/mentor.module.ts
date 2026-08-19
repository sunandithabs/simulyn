import { Module } from '@nestjs/common';
import { CloudLlmClient } from './cloud-llm.client';
import { MentorController } from './mentor.controller';
import { MentorService } from './mentor.service';
import { OllamaClient } from './ollama.client';

@Module({
  controllers: [MentorController],
  providers: [MentorService, OllamaClient, CloudLlmClient],
  exports: [MentorService],
})
export class MentorModule {}
