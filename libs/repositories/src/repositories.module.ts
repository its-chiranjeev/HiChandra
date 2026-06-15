import { Module } from '@nestjs/common';
import { RepositoriesService } from './repositories.service';
import { EntitiesModule } from '@hichandra/entities';
import { UserRepository } from './user.repository';
import { OtpRepository } from './otp.repository';
import { TechnicianProfileRepository } from './technician-profile.repository';
import { ServiceRepository } from './service.repository';
import { PlatformSettingRepository } from './platform-setting.repository';

@Module({
  imports: [EntitiesModule],
  providers: [
    RepositoriesService,
    UserRepository,
    OtpRepository,
    TechnicianProfileRepository,
    ServiceRepository,
    PlatformSettingRepository,
  ],
  exports: [
    RepositoriesService,
    UserRepository,
    OtpRepository,
    TechnicianProfileRepository,
    ServiceRepository,
    PlatformSettingRepository,
  ],
})
export class RepositoriesModule {}
