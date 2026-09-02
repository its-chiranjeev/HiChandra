import { IsNotEmpty, IsOptional, IsString, IsEmail, Length } from 'class-validator';
import { Transform } from 'class-transformer';

export class AdminCreateCustomerDto {
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => value?.trim())
  firstName!: string;

  @IsString()
  @IsOptional()
  @Transform(({ value }) => value?.trim())
  lastName?: string;

  @IsString()
  @IsOptional()
  @Transform(({ value }) => value?.trim())
  username?: string;

  @IsEmail()
  @IsNotEmpty()
  @Transform(({ value }) => value?.trim()?.toLowerCase())
  email!: string;

  @IsString()
  @IsNotEmpty()
  @Length(6, 50)
  password!: string;

  @IsString()
  @IsNotEmpty()
  @Length(10, 15)
  @Transform(({ value }) => value?.trim())
  phone!: string;

  @IsString()
  @IsOptional()
  @Length(1, 5)
  @Transform(({ value }) => value?.trim())
  countryCode?: string;

  @IsString()
  @IsOptional()
  @Transform(({ value }) => value?.trim())
  address?: string;



  @IsString()
  @IsOptional()
  @Transform(({ value }) => value?.trim())
  city?: string;

  @IsOptional()
  customerAddress?: string;
}
