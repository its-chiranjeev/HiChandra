import { Module } from '@nestjs/common';
import { BookingController } from './booking.controller';
import { BookingService } from './booking.service';
import { EntitiesModule } from '@hichandra/entities';
import { CommonAuthModule } from '@hichandra/common';
import { AuthModuleModule } from 'apps/auth-service/src/auth/auth-module.module';
import { AssignmentModule } from '../assignment/assignment.module';
import { EmailServicesModule } from '@hichandra/email-services';
import { PaymentModule } from '@hichandra/payment';
import { RepositoriesModule } from '@hichandra/repositories';
import { S3Module } from '@hichandra/s3';
import { SmsServicesModule } from '@hichandra/sms-services';

@Module({
  imports: [
    EntitiesModule,
    CommonAuthModule,
    PaymentModule,
    AuthModuleModule,
    AssignmentModule,
    EmailServicesModule,
    RepositoriesModule,
    S3Module,
    SmsServicesModule,
  ],
  controllers: [BookingController],
  providers: [BookingService],
  exports: [BookingService],
})
export class BookingModule { }
