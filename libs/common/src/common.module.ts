import { Module } from '@nestjs/common';
import { CommonService } from './common.service';
import { AuditModule } from './audit/audit.module';

@Module({
  imports: [AuditModule],
  providers: [CommonService],
  exports: [CommonService, AuditModule],
})
export class CommonModule {}
