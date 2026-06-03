import { Module } from '@nestjs/common';
import { AuthModuleService } from './auth-module.service';
import { AuthModuleController } from './auth-module.controller';
import { EntitiesModule } from '@hichandra/entities';
import { RepositoriesModule } from '@hichandra/repositories';
import { CommonAuthModule } from '@hichandra/common';
import { EmailServicesModule } from '@hichandra/email-services';

@Module({
  imports: [
    EntitiesModule,
    RepositoriesModule,
    CommonAuthModule,
    EmailServicesModule
  ],
  controllers: [AuthModuleController],
  providers: [AuthModuleService],
})
export class AuthModuleModule { }
