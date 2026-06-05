import { Module } from '@nestjs/common';
import { RepositoriesService } from './repositories.service';
import { EntitiesModule } from '@hichandra/entities';
import { UserRepository } from './user.repository';
import { OtpRepository } from './otp.repository';
import { TechnicianProfileRepository } from './technician-profile.repository';
import { ServiceRepository } from './service.repository';

@Module({
  imports: [EntitiesModule],
  providers: [
    RepositoriesService,
    UserRepository,
    OtpRepository,
    TechnicianProfileRepository,
    ServiceRepository,
    
  ],
  exports: [
    RepositoriesService,
    UserRepository,
    OtpRepository,
    TechnicianProfileRepository,
    ServiceRepository,
  ],
})
export class RepositoriesModule {}
