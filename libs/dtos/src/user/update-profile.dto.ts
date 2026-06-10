import { IsOptional, IsString, IsNumber, IsBoolean, IsArray, ValidateNested, IsObject } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class UpdateTechnicianLocationDto {
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
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
  @IsNumber()
  serviceRadiusKm?: number;
}

export class UpdateTechnicianProfileDetailsDto {
  @IsOptional()
  @IsNumber()
  yearsOfExperience?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  languages?: string[];

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
        return JSON.parse(value);
      } catch {
        return value;
      }
    }
    return value;
  })
  // @ValidateNested()
  @Type(() => UpdateTechnicianProfileDetailsDto)
  technicianProfile?: UpdateTechnicianProfileDetailsDto;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => UpdateTechnicianLocationDto)
  location?: UpdateTechnicianLocationDto;

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  services?: number[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  brandExpertise?: string[];
}
