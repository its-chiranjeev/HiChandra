import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { SKILL_LEVEL } from '@hichandra/entities';

export class TechnicianSkillDto {
  @IsNumber()
  @IsNotEmpty()
  serviceId!: number;

  @IsEnum(SKILL_LEVEL)
  @IsNotEmpty()
  experienceLevel!: SKILL_LEVEL;
}

export class TechnicianServiceAreaDto {
  @IsString()
  @IsNotEmpty()
  pincode!: string;

  @IsOptional()
  @IsString()
  areaName?: string;
}

export class TechnicianBrandExpertiseDto {
  @IsString()
  @IsNotEmpty()
  brandName!: string;
}

export class TechnicianProfileDto {
  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsNumber()
  yearsOfExperience?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  languages?: string[];

  @IsOptional()
  @IsNumber()
  serviceRadiusKm?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  preferredAreas?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  pincodes?: string[];

  @IsOptional()
  @IsString()
  accountHolderName?: string;

  @IsOptional()
  @IsString()
  accountNumber?: string;

  @IsOptional()
  @IsString()
  ifscCode?: string;

  @IsOptional()
  @IsString()
  bankName?: string;

  @IsOptional()
  @IsBoolean()
  hasLadder?: boolean;

  @IsOptional()
  @IsBoolean()
  hasACGauges?: boolean;

  @IsOptional()
  @IsBoolean()
  hasSafetyEquipment?: boolean;

  @IsOptional()
  @IsBoolean()
  hasVehicle?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TechnicianSkillDto)
  skills?: TechnicianSkillDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TechnicianServiceAreaDto)
  serviceAreas?: TechnicianServiceAreaDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TechnicianBrandExpertiseDto)
  brandExpertise?: TechnicianBrandExpertiseDto[];
}

export class RegisterDto {
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => value?.trim())
  email!: string; // email

  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => value?.trim())
  username!: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim())
  @MaxLength(15)
  phone?: string;

  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => value?.trim())
  firstName!: string;

  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => value?.trim())
  lastName!: string;

  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => value?.trim())
  password!: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }
    return value;
  })
  // @ValidateNested()
  @Type(() => TechnicianProfileDto)
  technicianProfile?: TechnicianProfileDto;
}

