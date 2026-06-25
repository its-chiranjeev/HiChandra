import { IsNumber } from 'class-validator';

export class TechnicianCancelBookingDto {
  @IsNumber()
  bookingId!: number;
}