import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContactUs } from '@hichandra/entities';
import { CommonModule } from '@hichandra/common';
import { EmailServicesModule } from '@hichandra/email-services';
import { ContactUsController } from './contact-us.controller';
import { ContactUsService } from './contact-us.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ContactUs]),
    CommonModule,
    EmailServicesModule,
  ],
  controllers: [ContactUsController],
  providers: [ContactUsService],
  exports: [ContactUsService],
})
export class ContactUsModule {}

