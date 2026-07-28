import { IsInt, IsString, IsNotEmpty, IsNumber, IsOptional } from 'class-validator';

export class CreateComplaintDto {
  @IsOptional()
  @IsInt()
  bookingId?: number;

  @IsOptional()
  @IsNumber()
  serviceId?: number;

  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsNotEmpty()
  description!: string;
}