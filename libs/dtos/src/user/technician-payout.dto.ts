import { IsInt, IsNumber, Min, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateTechnicianPayoutDto {
  @Type(() => Number)
  @IsInt()
  bookingId!: number;

  // @IsInt()
  // serviceId!: number;

  // @IsInt()
  // technicianId!: number;

  // @IsNumber()
  // @Min(1)
  // totalAmount!: number;
}

export class AdminCreatePayoutDto {
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @IsNotEmpty()
  amount!: number;

  @Type(() => Number)
  @IsInt()
  @IsNotEmpty()
  bookingId!: number;

  @Type(() => Number)
  @IsInt()
  @IsNotEmpty()
  technicianId!: number;
}