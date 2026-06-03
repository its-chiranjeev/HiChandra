import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { EntitiesModule } from '@optechular/entities';
import { RepositoriesModule } from '@optechular/repositories';
import { CommonAuthModule } from '@optechular/common';


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
