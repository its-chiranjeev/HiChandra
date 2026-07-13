import {IsInt, IsOptional, IsString, Min, MinLength,} from 'class-validator';

export class CancelBookingDto {
  @IsInt()
  @Min(1)
  bookingId!: number;

  @IsOptional()
  @IsString()
  @MinLength(5)
  cancellationReason?: string;
}