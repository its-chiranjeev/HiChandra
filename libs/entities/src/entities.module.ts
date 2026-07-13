import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { User } from './user.entity';
import { Otp } from './otp.entity';
import { TechnicianProfile } from './technician-profile.entity';
import { TechnicianService } from './technician-service.entity';
import { TechnicianBrandExpertise } from './technician-brand-expertise.entity';
import { Service } from './service.entity';
import { PricingRule } from './pricing-rule.entity';
import { PlatformSetting } from './platform-setting.entity';
import { TechnicianLocation } from './technician-location.entity';
import { ServiceSpecification } from './service-specification.entity';
import { CustomerAddress } from './customer-address.entity';
import { Booking } from './booking.entity';
import { Payment } from './payment.entity';
import { EntitiesService } from './entities.service';
import { Complaint } from './complaint.entity';
import { TechnicianPayout } from './technician-payout.entity';
import { FavoriteTechnician } from './favorite-technician.entity';
import { TechnicianPayoutAccount } from './technician-payout-account.entity';


@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Otp,
      TechnicianProfile,
      TechnicianService,
      TechnicianBrandExpertise,
      Service,
      PricingRule,
      PlatformSetting,
      TechnicianLocation,
      ServiceSpecification,
      CustomerAddress,
      Booking,
      Payment,
      Complaint,
      TechnicianPayout,
      FavoriteTechnician,
      TechnicianPayoutAccount,
    ]),
  ],
  providers: [EntitiesService],
  exports: [
    TypeOrmModule, // VERY IMPORTANT
  ],
})
export class EntitiesModule {}
