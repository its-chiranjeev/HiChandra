import { IsInt, IsString, IsNotEmpty, IsNumber } from 'class-validator';

export class CreateComplaintDto {
  @IsInt()
  bookingId!: number;

  @IsNumber()
  @IsNotEmpty()
  serviceId!: number;

  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsNotEmpty()
  description!: string;

}