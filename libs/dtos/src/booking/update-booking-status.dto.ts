import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { BOOKING_STATUS } from '@hichandra/entities';

export class UpdateBookingStatusDto {
  @IsEnum(BOOKING_STATUS)
  @IsNotEmpty()
  status!: BOOKING_STATUS;

  @IsOptional()
  @IsString()
  cancellationReason?: string;
}
