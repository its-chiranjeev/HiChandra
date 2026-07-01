import { Module } from '@nestjs/common';
import { EmailService } from './email-services.service';
import { SmsService } from './providers/sms-service';

@Module({
  controllers: [],
  providers: [EmailService, SmsService],
  exports: [EmailService, SmsService],
})
export class EmailServicesModule {}
