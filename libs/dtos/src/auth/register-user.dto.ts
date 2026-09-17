import { USER_ROLE } from '@hichandra/entities';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class RegisterUserDto {
  @IsOptional()
  @IsEmail()
  @Transform(({ value }) => value?.trim().toLowerCase())
  email?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim())
  @MaxLength(15)
  phone?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim())
  @MaxLength(5)
  countryCode?: string;

  @IsEnum(USER_ROLE)
  @IsNotEmpty()
  @Transform(({ value }) => value.toUpperCase())
  role!: USER_ROLE;
}
