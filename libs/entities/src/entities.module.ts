import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { User } from './user.entity';
import { Otp } from './otp.entity';
import { TechnicianProfile } from './technician-profile.entity';
import { TechnicianSkill } from './technician-skill.entity';
import { TechnicianServiceArea } from './technician-service-area.entity';
import { TechnicianBrandExpertise } from './technician-brand-expertise.entity';
import { Service } from './service.entity';
import { PricingRule } from './pricing-rule.entity';
import { PlatformSetting } from './platform-setting.entity';
import { EntitiesService } from './entities.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Otp,
      TechnicianProfile,
      TechnicianSkill,
      TechnicianServiceArea,
      TechnicianBrandExpertise,
      Service,
      PricingRule,
      PlatformSetting,
    ]),
  ],
  providers: [EntitiesService],
  exports: [
    TypeOrmModule, // VERY IMPORTANT
  ],
})
export class EntitiesModule { }
