import { Module } from '@nestjs/common';
import { BookingController } from './booking.controller';
import { BookingService } from './booking.service';
import { EntitiesModule } from '@hichandra/entities';
import { CommonAuthModule } from '@hichandra/common';
import { AuthModuleModule } from 'apps/auth-service/src/auth/auth-module.module';
import { AssignmentModule } from '../assignment/assignment.module';

@Module({
  imports: [
    EntitiesModule,
    CommonAuthModule,
    AuthModuleModule,
    AssignmentModule,
  ],
  controllers: [BookingController],
  providers: [BookingService],
  exports: [BookingService],
})
export class BookingModule { }
