import { IsInt, IsNumber, Min } from 'class-validator';

export class CreateTechnicianPayoutDto {
  @IsInt()
  bookingId!: number;

  @IsInt()
  serviceId!: number;

  @IsInt()
  technicianId!: number;

  @IsNumber()
  @Min(1)
  totalAmount!: number;
}