import { IsNotEmpty, IsDate } from 'class-validator';
import { Type } from 'class-transformer';

export class AcceptBookingDto {
  @Type(() => Date)
  @IsDate()
  @IsNotEmpty()
  scheduledAt!: Date;
}
