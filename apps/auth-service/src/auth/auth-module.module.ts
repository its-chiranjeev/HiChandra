import { Module } from '@nestjs/common';
import { AuthModuleService } from './auth-module.service';
import { AuthModuleController } from './auth-module.controller';
import { EntitiesModule } from '@hichandra/entities';
import { RepositoriesModule } from '@hichandra/repositories';
import { CommonAuthModule } from '@hichandra/common';

@Module({
  imports: [EntitiesModule, RepositoriesModule, CommonAuthModule],
  controllers: [AuthModuleController],
  providers: [AuthModuleService],
})
export class AuthModuleModule { }
