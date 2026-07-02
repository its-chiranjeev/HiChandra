import { IsInt, IsNumber, Min} from 'class-validator';
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