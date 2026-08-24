import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsDate,
  IsArray,
  ValidateNested,
  IsString,
} from 'class-validator';
import { Type } from 'class-transformer';

export class BookingSpecificationDto {
  @IsNumber()
  @IsNotEmpty()
  specificationId!: number;

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

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BookingSpecificationDto)
  serviceSpecifications!: BookingSpecificationDto[];

  @IsOptional()
  @IsBoolean()
  isEmergency?: boolean;

  @IsOptional()
  @IsBoolean()
  isManualAssign?: boolean;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  scheduledAt?: Date;

  @Type(() => Date)
  @IsDate()
  @IsNotEmpty()
  fromTime!: Date;

  @Type(() => Date)
  @IsDate()
  @IsNotEmpty()
  toTime!: Date;
}
