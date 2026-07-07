import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsString,
  MinLength,
} from 'class-validator';

export class LoginDto {
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => value?.trim())
  identifier!: string; // email OR phone number

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  @Transform(({ value }) => value?.trim())
  password!: string;
  
}