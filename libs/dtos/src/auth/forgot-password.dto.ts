import { IsEmail, IsPhoneNumber, IsNotEmpty, IsString, MinLength, IsOptional, MaxLength } from 'class-validator';

export class ForgotPasswordDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5)
  countryCode?: string;
}

export class ResetPasswordDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5)
  countryCode?: string;

  @IsString()
  @IsNotEmpty()
  otp!: string;

  @IsString()
  @MinLength(6)
  newPassword!: string;
}