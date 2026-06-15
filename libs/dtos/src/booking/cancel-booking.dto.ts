import { IsInt, IsString, Min, MinLength } from 'class-validator';

export class CancelBookingDto {
  @IsInt()
  @Min(1)
  bookingId!: number;

  @IsString()
  @MinLength(5)
  cancellationReason!: string;
}