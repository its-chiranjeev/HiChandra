import {
  IsNotEmpty,
  IsString,
  IsEmail,
  MaxLength,
  IsOptional,
  IsEnum,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CONTACT_US_STATUS } from '@hichandra/entities';

export class CreateContactUsDto {
  @IsNotEmpty({ message: 'Name is required' })
  @IsString({ message: 'Name must be a string' })
  @MaxLength(150, { message: 'Name must not exceed 150 characters' })
  name!: string;

  @IsNotEmpty({ message: 'Email is required' })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @MaxLength(150, { message: 'Email must not exceed 150 characters' })
  email!: string;

  @IsNotEmpty({ message: 'Subject is required' })
  @IsString({ message: 'Subject must be a string' })
  @MaxLength(255, { message: 'Subject must not exceed 255 characters' })
  subject!: string;

  @IsNotEmpty({ message: 'Message is required' })
  @IsString({ message: 'Message must be a string' })
  message!: string;
}

export class GetAllContactUsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Page must be an integer' })
  @Min(1, { message: 'Page must be at least 1' })
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Limit must be an integer' })
  @Min(1, { message: 'Limit must be at least 1' })
  @Max(100, { message: 'Limit must not exceed 100' })
  limit?: number = 10;

  @IsOptional()
  @IsEnum(CONTACT_US_STATUS, {
    message: 'Status must be a valid CONTACT_US_STATUS',
  })
  status?: CONTACT_US_STATUS;

  @IsOptional()
  @IsString({ message: 'Search must be a string' })
  search?: string;
}

export class UpdateContactUsStatusDto {
  @IsNotEmpty({ message: 'Status is required' })
  @IsEnum(CONTACT_US_STATUS, {
    message: 'Status must be a valid CONTACT_US_STATUS',
  })
  status!: CONTACT_US_STATUS;

  @IsNotEmpty({ message: 'Message is required' })
  @IsString({ message: 'Message must be a string' })
  message!: string;
}

