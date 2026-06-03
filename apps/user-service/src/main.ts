import { NestFactory } from '@nestjs/core';
import { UserManagementModule } from './user-management.module';
import { Logger, UnprocessableEntityException, ValidationPipe } from '@nestjs/common';
import { ResponseInterceptor } from '@optechular/common';
import { GlobalExceptionFilter } from '@optechular/common';
import { Request, Response, NextFunction } from 'express';


async function bootstrap() {
  const app = await NestFactory.create(UserManagementModule);
  app.setGlobalPrefix('api');

  const logger = new Logger('HTTP');

  // APPLY LOGGER EARLY
  app.use((req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();

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
        `${colorStart}${req.method} ${req.originalUrl} -> ${status} - ${duration}ms${reset}`,
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
      exceptionFactory: (errors) => {
        const errorMessages = errors.flatMap((err) =>
          Object.values(err.constraints || {}),
        );

        return new UnprocessableEntityException({
          success: false,
        });
      },
    }),
  );
  
  const port = process.env.USER_MANAGEMENT_PORT || 5001;
  await app.listen(port);

  Logger.log(`🚀 User Management Server running on http://localhost:${port}/api`);
}

bootstrap();

