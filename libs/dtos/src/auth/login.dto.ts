import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class LoginDto {
  // @IsString()
  // @IsNotEmpty()
  // @Transform(({ value }) => value?.trim())
  // email!: string; // email OR username

  @ValidateIf((o) => !o.phone)
  @IsEmail()
  @IsNotEmpty()
  @Transform(({ value }) => value?.trim().toLowerCase())
  email?: string;

  @ValidateIf((o) => !o.email)
  @IsNotEmpty()
  phone?: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  @Transform(({ value }) => value?.trim())
  password!: string;
}
