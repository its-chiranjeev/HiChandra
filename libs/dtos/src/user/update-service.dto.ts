import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  IsArray,
  ValidateNested,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum ServiceSpecType {
  TEXT = 'text',
  SELECT = 'select',
  MULTISELECT = 'multiselect',
  NUMBER = 'number',
  IMAGE = 'image',
}

export class UpdateServiceSpecificationDto {
  @IsOptional()
  @IsNumber()
  id?: number; // if exists → update, if not → create

  @IsString()
  name!: string;

  @IsEnum(ServiceSpecType)
  type!: ServiceSpecType;

  @IsOptional()
  @IsArray()
  values?: string[] | number[];

  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateServiceDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  // pricing
  @IsOptional()
  @IsNumber()
  serviceBasePrice?: number;

  @IsOptional()
  @IsNumber()
  perHourRate?: number;

  @IsOptional()
  @IsNumber()
  perKmRate?: number;

  @IsOptional()
  @IsNumber()
  weekendMultiplier?: number;

  @IsOptional()
  @IsNumber()
  peakHourMultiplier?: number;

  @IsOptional()
  @IsArray()
  peakHours?: any[];

  @IsOptional()
  @IsNumber()
  emergencyCharge?: number;

  @IsOptional()
  @IsNumber()
  freeDistanceKm?: number;

  @IsOptional()
  @IsNumber()
  distanceChargePerKm?: number;

  @IsOptional()
  @IsNumber()
  surgeFactor?: number;

  @IsOptional()
  @IsBoolean()
  isSurgeEnabled?: boolean;

  @IsOptional()
  @IsNumber()
  platformFee?: number;

  @IsOptional()
  @IsNumber()
  gst?: number;

  @IsOptional()
  @IsString()
  iconUrl?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateServiceSpecificationDto)
  specifications?: UpdateServiceSpecificationDto[];
}