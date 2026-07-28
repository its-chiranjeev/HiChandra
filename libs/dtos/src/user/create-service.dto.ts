import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsNumber,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsArray,
  ValidateNested,
  IsEnum,
} from 'class-validator';

const toBoolean = ({ obj, key }: any) => {
  const value = obj[key];
  if (value === 'true' || value === true) return true;
  if (value === 'false' || value === false) return false;
  return value;
};

export class PeakHourDto {
  @IsNumber()
  @IsNotEmpty()
  start!: number;

  @IsNumber()
  @IsNotEmpty()
  end!: number;
}

export class CreateServiceSpecificationDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsEnum(['text', 'select', 'multiselect', 'number', 'image'])
  @IsNotEmpty()
  type!: string;

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

export class CreateServiceDto {
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => value?.trim())
  name!: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim())
  description?: string;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return value;
    const num = Number(value);
    return isNaN(num) ? value : num;
  })
  @IsNumber()
  serviceBasePrice?: number;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return value;
    const num = Number(value);
    return isNaN(num) ? value : num;
  })
  @IsNumber()
  perHourRate?: number;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return value;
    const num = Number(value);
    return isNaN(num) ? value : num;
  })
  @IsNumber()
  perKmRate?: number;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return value;
    const num = Number(value);
    return isNaN(num) ? value : num;
  })
  @IsNumber()
  weekendMultiplier?: number;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return value;
    const num = Number(value);
    return isNaN(num) ? value : num;
  })
  @IsNumber()
  peakHourMultiplier?: number;

  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch (e) {
        return value;
      }
    }
    return value;
  })
  @IsArray()
  // @ValidateNested({ each: true })
  // @Type(() => PeakHourDto)
  peakHours?: PeakHourDto[];

  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return value;
    const num = Number(value);
    return isNaN(num) ? value : num;
  })
  @IsNumber()
  emergencyCharge?: number;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return value;
    const num = Number(value);
    return isNaN(num) ? value : num;
  })
  @IsNumber()
  freeDistanceKm?: number;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return value;
    const num = Number(value);
    return isNaN(num) ? value : num;
  })
  @IsNumber()
  distanceChargePerKm?: number;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return value;
    const num = Number(value);
    return isNaN(num) ? value : num;
  })
  @IsNumber()
  surgeFactor?: number;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  @IsBoolean()
  isSurgeEnabled?: boolean;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return value;
    const num = Number(value);
    return isNaN(num) ? value : num;
  })
  @IsNumber()
  platformFee?: number;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return value;
    const num = Number(value);
    return isNaN(num) ? value : num;
  })
  @IsNumber()
  gst?: number;

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
  @Transform(toBoolean)
  @IsBoolean()
  isServiceBasePriceApplied?: boolean;

  @IsOptional()
  @IsString()
  iconUrl?: string;

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
  // @Type(() => CreateServiceSpecificationDto)
  specifications?: CreateServiceSpecificationDto[];

  @IsOptional()
  icon?: any;
}
