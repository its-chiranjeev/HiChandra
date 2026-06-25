import { IsDateString, IsNotEmpty } from 'class-validator';

export class RepeatBookingDto {
  @IsNotEmpty()
  @IsDateString()
  scheduledAt!: string;
}