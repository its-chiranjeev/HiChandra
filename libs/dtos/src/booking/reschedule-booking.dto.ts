import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class RescheduleBookingDto {
  @IsNotEmpty()
  @IsDateString()
  scheduledAt!: string;
}