import { IsOptional, IsString, IsNumber, IsBoolean, IsArray, ValidateNested, IsObject, Matches } from 'class-validator';
import { plainToInstance, Transform, Type } from 'class-transformer';

export class UpdateTechnicianLocationDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  longitude?: number;

  @IsOptional()
  @IsString()
  fullAddress?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  pincode?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  serviceRadiusKm?: number;
}

export class UpdateTechnicianProfileDetailsDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  yearsOfExperience?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  languages?: string[];

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  hasLadder?: boolean;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  hasACGauges?: boolean;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  hasSafetyEquipment?: boolean;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  hasVehicle?: boolean;

  @IsOptional()
  @IsString()
  @Matches(
    /^[a-zA-Z0-9.\-_]+@[a-zA-Z0-9.\-_]+$/,
    {
      message: 'Invalid UPI ID',
    },
  )
  upiId?: string;

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
}

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  emergencyContact?: string;

  @IsOptional()
  @IsString()
  profileImage?: string;

  // Technician specific fields (ignored for non-technicians)
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return plainToInstance(UpdateTechnicianProfileDetailsDto, parsed);
      } catch {
        return value;
      }
    }
    return value;
  })
  @ValidateNested()
  @Type(() => UpdateTechnicianProfileDetailsDto)
  technicianProfile?: UpdateTechnicianProfileDetailsDto;

  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return plainToInstance(UpdateTechnicianLocationDto, parsed);
      } catch {
        return value;
      }
    }
    return value;
  })
  @ValidateNested()
  @Type(() => UpdateTechnicianLocationDto)
  location?: UpdateTechnicianLocationDto;

  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return value.split(',').map(Number);
      }
    }
    return value;
  })
  @IsArray()
  @IsNumber({}, { each: true })
  services?: number[];

  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return value.split(',').map(v => v.trim());
      }
    }
    return value;
  })
  @IsArray()
  @IsString({ each: true })
  brandExpertise?: string[];
}
