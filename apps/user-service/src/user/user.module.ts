import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { EntitiesModule } from '@hichandra/entities';
import { RepositoriesModule } from '@hichandra/repositories';
import { CommonAuthModule } from '@hichandra/common';
import { AuthModuleModule } from 'apps/auth-service/src/auth/auth-module.module';
import { S3Module } from '@hichandra/s3';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Service, PricingRule } from '@hichandra/entities';
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
],
  controllers: [UserController],
  providers: [UserService],
})
export class UserModule {}
