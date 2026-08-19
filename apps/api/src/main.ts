import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';

import { AppModule } from './app.module';
import { REFRESH_COOKIE } from './config/configuration';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: false });
  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  app.use(cookieParser());

  app.enableCors({
    origin: config.get<string[]>('corsOrigin') ?? ['http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
      validationError: { target: false, value: false },
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('SIMULYN API')
    .setDescription('Virtual engineering labs — programming & electronics education platform')
    .setVersion('0.1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' })
    .addCookieAuth(REFRESH_COOKIE)
    .addTag('auth', 'Sign-in, token refresh and password changes')
    .addTag('users', 'Account management')
    .addTag('classes', 'Classes and enrollment')
    .addTag('problems', 'Problem bank and class assignment')
    .addTag('execution', 'Code execution and electronics grading')
    .addTag('submissions', 'Graded submissions and test results')
    .addTag('exams', 'Exam scheduling, attempts and results')
    .addTag('proctoring', 'Violations and the live proctoring channel')
    .addTag('gamification', 'XP, levels, streaks, badges and leaderboards')
    .addTag('mentor', 'Socratic AI hints')
    .addTag('analytics', 'Class and problem analytics')
    .addTag('discussions', 'Per-problem discussion threads')
    .addTag('admin', 'System overview, health and configuration')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  const port = config.get<number>('port') ?? 3001;
  await app.listen(port);

  logger.log(`SIMULYN API listening on http://localhost:${port}`);
  logger.log(`Swagger UI at http://localhost:${port}/api/docs`);
}

void bootstrap();
