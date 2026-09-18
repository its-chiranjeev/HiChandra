import { NestFactory } from '@nestjs/core';
import { UserManagementModule } from './user-management.module';
import {
  Logger,
  UnprocessableEntityException,
  ValidationPipe,
} from '@nestjs/common';
import { ResponseInterceptor, GlobalExceptionFilter, requestContextMiddleware, RequestContext } from '@hichandra/common';
import { Request, Response, NextFunction } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(UserManagementModule);
  app.setGlobalPrefix('api');

  // Request context middleware (AsyncLocalStorage for requestId & client IP)
  app.use(requestContextMiddleware);

  // Need to be commented in production
  if (process.env.NODE_ENV !== 'production') {
    app.enableCors({
      origin: true, // Allow all origins
      credentials: true,
      methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    });
  }

  const logger = new Logger('HTTP');

  // APPLY LOGGER EARLY
  app.use((req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    const reqId = RequestContext.getRequestId();

    res.on('finish', () => {
      const duration = Date.now() - start;
      const status = res.statusCode;

      let colorStart = '\x1b[0m';
      const reset = '\x1b[0m';

      if (status >= 200 && status < 300) {
        colorStart = '\x1b[32m'; // green
      } else if (status >= 400) {
        colorStart = '\x1b[31m'; // red
      } else if (status >= 300) {
        colorStart = '\x1b[33m'; // yellow
      }

      logger.log(
        `${colorStart}[${reqId || '-'}] ${req.method} ${req.originalUrl} -> ${status} - ${duration}ms${reset}`,
      );
    });

    next();
  });

  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new GlobalExceptionFilter());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      // exceptionFactory: (errors) => {
      //   const errorMessages = errors.flatMap((err) =>
      //     Object.values(err.constraints || {}),
      //   );

      //   return new UnprocessableEntityException({
      //     success: false,
      //     message: 'Validation failed',
      //     error: errorMessages,
      //   });
      // },
      exceptionFactory: (errors) => {
        const errorMessages = formatValidationErrors(errors);

        return new UnprocessableEntityException({
          success: false,
          message: 'Validation failed',
          error: errorMessages,
        });
      },
    }),
  );

  const port = process.env.USER_MANAGEMENT_PORT || 5001;
  await app.listen(port);

  Logger.log(
    `🚀 User Management Server running on http://localhost:${port}/api`,
  );
}

function formatValidationErrors(errors: any[], parent = ''): string[] {
  return errors.flatMap((err) => {
    const property = parent ? `${parent}.${err.property}` : err.property;

    const currentErrors = err.constraints
      ? Object.values(err.constraints).map((msg) => `${property}: ${msg}`)
      : [];

    const childErrors = err.children?.length
      ? formatValidationErrors(err.children, property)
      : [];

    return [...currentErrors, ...childErrors];
  });
}

bootstrap();
