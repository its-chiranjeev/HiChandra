import { IsOptional, IsString, IsNumber, IsBoolean, IsArray, ValidateNested, IsEmail } from 'class-validator';
import { plainToInstance, Transform, Type } from 'class-transformer';

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
  gst?: string;

  @IsOptional()
  @IsString()
  panUrl?: string;

  @IsOptional()
  @IsString()
  policeCertUrl?: string;

  @IsOptional()
  @IsString()
  tradeLicenseUrl?: string;

  @IsOptional()
  @IsString()
  selfieUrl?: string;
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

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  password?: string;

  // Technician specific fields
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
}
