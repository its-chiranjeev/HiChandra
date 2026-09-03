import { Module } from '@nestjs/common';
import { UserManagementController } from './user-management.controller';
import { UserModule } from './user/user.module';
import { BookingModule } from './booking/booking.module';

import { DatabaseModule } from '@hichandra/database';
import { UserManagementService } from './user-management.service';
import { EntitiesModule } from '@hichandra/entities';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';

import { CommonModule } from '@hichandra/common';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    DatabaseModule,
    EntitiesModule,
    CommonModule,
    UserModule,
    BookingModule,
  ],
  controllers: [UserManagementController],
  providers: [UserManagementService],
})
export class UserManagementModule { }
