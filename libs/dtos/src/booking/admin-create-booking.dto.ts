import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsDate,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { BookingSpecificationDto } from './create-booking.dto';

export class AdminCreateBookingDto {
  @IsNumber()
  @IsNotEmpty()
  customerId!: number;

  @IsNumber()
  @IsNotEmpty()
  technicianId!: number;

  @IsNumber()
  @IsNotEmpty()
  serviceId!: number;

  @IsNumber()
  @IsOptional()
  customerAddressId?: number;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => BookingSpecificationDto)
  serviceSpecifications?: BookingSpecificationDto[];

  @IsOptional()
  @IsBoolean()
  isEmergency?: boolean;

  @IsNotEmpty()
  @Type(() => Date)
  @IsDate()
  scheduledAt!: Date;
}
