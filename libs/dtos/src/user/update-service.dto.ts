import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  IsArray,
  ValidateNested,
  IsEnum,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

const toBoolean = ({ obj, key }: any) => {
  const value = obj[key];
  if (value === 'true' || value === true) return true;
  if (value === 'false' || value === false) return false;
  return value;
};

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
  @Transform(toBoolean)
  @IsBoolean()
  isRequired?: boolean;

  @IsOptional()
  @Transform(toBoolean)
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
  @Transform(toBoolean)
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
  @Transform(toBoolean)
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
  @Transform(toBoolean)
  @IsBoolean()
  isServiceBasePriceApplied?: boolean;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  isGstApplied?: boolean;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  isDistanceKmApplied?: boolean;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  isWeekendApplied?: boolean;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  isPeakHourApplied?: boolean;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  isEmergencyApplied?: boolean;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  isPlatformFeeApplied?: boolean;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  isPerHourRateApplied?: boolean;

  @IsOptional()
  @IsArray()
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
  // @ValidateNested({ each: true })
  // @Type(() => UpdateServiceSpecificationDto)
  specifications?: UpdateServiceSpecificationDto[];
}