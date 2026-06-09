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
  @IsBoolean()
  isRequired?: boolean;

  @IsOptional()
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
  @IsBoolean()
  isActive?: boolean;

  @IsNumber()
  @IsNotEmpty()
  serviceBasePrice!: number;

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
