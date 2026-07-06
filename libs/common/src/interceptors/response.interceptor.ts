import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  StreamableFile,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class ResponseInterceptor<T>
  implements NestInterceptor<T, T | StreamableFile>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<T | StreamableFile> {
    const response = context.switchToHttp().getResponse();

    return next.handle().pipe(
      map((data) => {
        if (data instanceof StreamableFile) {
          return data;
        }

        if (
          data &&
          typeof data === 'object' &&
          'success' in data &&
          'statusCode' in data
        ) {
          return data;
        }

        const message =
          data &&
          typeof data === 'object' &&
          'message' in (data as Record<string, unknown>)
            ? String((data as Record<string, unknown>).message)
            : 'Request successful';

        return {
          success: true,
          statusCode: response.statusCode,
          message,
          data,
        } as T;
      }),
    );
  }
}