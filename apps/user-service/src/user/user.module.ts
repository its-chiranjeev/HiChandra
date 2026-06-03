import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { EntitiesModule } from '@hichandra/entities';
import { RepositoriesModule } from '@hichandra/repositories';
import { CommonAuthModule } from '@hichandra/common';


@Module({
  imports: [
      EntitiesModule,
      RepositoriesModule,
      CommonAuthModule,
    ],
  controllers: [UserController],
  providers: [UserService],
})
export class UserModule { }
