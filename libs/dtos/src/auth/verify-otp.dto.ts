import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { USER_ROLE } from '@hichandra/entities';

export class VerifyOtpDto {

  @IsOptional()
  @IsEmail()  
  @Transform(({ value }) => value?.trim().toLowerCase())
  email?: string;

  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => value?.trim())
  @MaxLength(15)
  phone?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim())
  @MaxLength(5)
  countryCode?: string;

  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => value?.trim())
  otp!: string;
}
