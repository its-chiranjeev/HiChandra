import { IsNotEmpty, IsOptional, IsString, IsEmail, Length } from 'class-validator';
import { Transform } from 'class-transformer';

export class AdminCreateTechnicianDto {
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => value?.trim())
  firstName!: string;

  @IsString()
  @IsOptional()
  @Transform(({ value }) => value?.trim())
  lastName?: string;

  @IsString()
  @IsNotEmpty()
  @Length(10, 15)
  @Transform(({ value }) => value?.trim())
  phone!: string;

  @IsEmail()
  @IsOptional()
  @Transform(({ value }) => value?.trim()?.toLowerCase())
  email?: string;

  @IsString()
  @IsNotEmpty()
  @Length(6, 50)
  password!: string;
}
