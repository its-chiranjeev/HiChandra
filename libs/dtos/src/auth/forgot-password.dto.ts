import { IsEmail, IsPhoneNumber, IsNotEmpty, IsString, MinLength, IsOptional } from 'class-validator';

export class ForgotPasswordDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsPhoneNumber('IN')
  phone?: string;
}

export class ResetPasswordDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsPhoneNumber('IN')
  phone?: string;;

  @IsString()
  @IsNotEmpty()
  otp!: string;

  @IsString()
  @MinLength(6)
  newPassword!: string;
}