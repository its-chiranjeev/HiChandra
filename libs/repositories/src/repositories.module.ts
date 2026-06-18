import { Module } from '@nestjs/common';
import { RepositoriesService } from './repositories.service';
import { EntitiesModule } from '@hichandra/entities';
import { UserRepository } from './user.repository';
import { OtpRepository } from './otp.repository';
import { TechnicianProfileRepository } from './technician-profile.repository';
import { ServiceRepository } from './service.repository';
import { PlatformSettingRepository } from './platform-setting.repository';
import { BookingRepository } from './booking.repository';
import { ComplaintRepository } from './complaint.repository';
import { PaymentRepository } from './payment.repository';
import { TechnicianPayoutRepository } from './technician-payout.repository';

@Module({
  imports: [EntitiesModule],
  providers: [
    RepositoriesService,
    UserRepository,
    OtpRepository,
    TechnicianProfileRepository,
    ServiceRepository,
    PlatformSettingRepository,
    BookingRepository,
     ComplaintRepository,
    PaymentRepository,
    TechnicianPayoutRepository,
  ],
  exports: [
    RepositoriesService,
    UserRepository,
    OtpRepository,
    TechnicianProfileRepository,
    ServiceRepository,
    PlatformSettingRepository,
    BookingRepository,
    ComplaintRepository,
    PaymentRepository,
    TechnicianPayoutRepository
  ],
})
export class RepositoriesModule {}
