import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { EntitiesModule } from '@hichandra/entities';
import { RepositoriesModule } from '@hichandra/repositories';
import { CommonAuthModule } from '@hichandra/common';
import { AuthModuleModule } from 'apps/auth-service/src/auth/auth-module.module';
import { S3Module } from '@hichandra/s3';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Service, PricingRule } from '@hichandra/entities';
import { PaymentModule } from '@hichandra/payment';
import { SmsServicesModule } from '@hichandra/sms-services';
import { EmailServicesModule } from '@hichandra/email-services';
import { NotificationModule } from '@hichandra/notification';

@Module({
imports: [
  TypeOrmModule.forFeature([
    Service,
    PricingRule,
  ]),
  EntitiesModule,
  RepositoriesModule,
  CommonAuthModule,
  AuthModuleModule,
  S3Module,
  PaymentModule,
  SmsServicesModule,
  EmailServicesModule,
  NotificationModule,
],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
