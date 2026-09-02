import { IsOptional, IsDate } from 'class-validator';
import { Type } from 'class-transformer';

export class AcceptBookingDto {
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  scheduledAt?: Date;
}
