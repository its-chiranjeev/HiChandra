import { IsNotEmpty, IsNumber, IsOptional, IsBoolean, IsDate, IsObject } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateBookingDto {
  @IsNumber()
  @IsNotEmpty()
  serviceId!: number;

  @IsNumber()
  @IsNotEmpty()
  customerAddressId!: number;

  @IsOptional()
  @IsObject()
  serviceSpecifications?: Record<string, any>;

  @IsOptional()
  @IsBoolean()
  isEmergency?: boolean;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  scheduledAt?: Date;
}
