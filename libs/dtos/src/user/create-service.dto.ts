import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsNumber,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsArray,
  ValidateNested,
} from 'class-validator';

export class PeakHourDto {
  @IsNumber()
  @IsNotEmpty()
  start!: number;

  @IsNumber()
  @IsNotEmpty()
  end!: number;
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
  baseFare!: number;

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
  icon?: any;
}
