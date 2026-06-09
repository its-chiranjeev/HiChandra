import { IsNotEmpty, IsNumber, IsOptional, IsBoolean, IsDate, IsArray, ValidateNested, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class BookingSpecificationDto {
  @IsOptional()
  @IsNumber()
  specificationId?: number;

  @IsOptional()
  @IsNumber()
  subSpecificationServiceId?: number;

  @IsOptional()
  @IsString()
  name?: string;

  @IsNotEmpty()
  value!: any;
}

export class CreateBookingDto {
  @IsNumber()
  @IsNotEmpty()
  serviceId!: number;

  @IsNumber()
  @IsNotEmpty()
  customerAddressId!: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BookingSpecificationDto)
  serviceSpecifications?: BookingSpecificationDto[];

  @IsOptional()
  @IsBoolean()
  isEmergency?: boolean;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  scheduledAt?: Date;
}
