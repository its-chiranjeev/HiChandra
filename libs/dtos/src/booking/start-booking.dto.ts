import { IsNotEmpty, IsString } from 'class-validator';

export class StartBookingDto {
  @IsString()
  @IsNotEmpty()
  otp!: string;
}
