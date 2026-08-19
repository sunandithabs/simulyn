import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';

/** Logs method, path, status and duration for every HTTP request. */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const { method, originalUrl } = request;
    const startedAt = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          this.logger.log(`${method} ${originalUrl} ${response.statusCode} - ${Date.now() - startedAt}ms`);
        },
        error: (err: { status?: number }) => {
          this.logger.warn(`${method} ${originalUrl} ${err?.status ?? 500} - ${Date.now() - startedAt}ms`);
        },
      }),
    );
  }
}
