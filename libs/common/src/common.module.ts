import { Module } from '@nestjs/common';
import { CommonService } from './common.service';
import { AuditModule } from './audit/audit.module';
import { RequestContextMiddleware } from './middleware/request-context.middleware';

@Module({
  imports: [AuditModule],
  providers: [CommonService, RequestContextMiddleware],
  exports: [CommonService, AuditModule, RequestContextMiddleware],
})
export class CommonModule {}

