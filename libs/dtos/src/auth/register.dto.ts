import { Transform, Type, plainToInstance } from 'class-transformer';
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
  Matches,
  ValidateIf,
} from 'class-validator';
export class TechnicianServiceDto {
  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty()
  serviceId!: number;
}

export class TechnicianBrandExpertiseDto {
  @IsString()
  @IsNotEmpty()
  brandName!: string;
}

const toBoolean = ({ value }: { value: any }) => {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return value;
};

export class TechnicianProfileDto {
  @IsOptional()
  @IsString()
  address?: string;

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
  yearsOfExperience?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  languages?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  serviceRadiusKm?: number;

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

  @IsOptional()
  @IsString()
  gst?: string;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  hasLadder?: boolean;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  hasACGauges?: boolean;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  hasSafetyEquipment?: boolean;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  hasVehicle?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TechnicianServiceDto)
  services?: TechnicianServiceDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TechnicianBrandExpertiseDto)
  brandExpertise?: TechnicianBrandExpertiseDto[];
}

export class CustomerAddressDto {
  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty()
  latitude!: number;

  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty()
  longitude!: number;

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
  @IsString()
  label?: string;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  isDefault?: boolean;
}

export class RegisterDto {
  @IsString()
  @IsOptional()
  @Transform(({ value }) => value?.trim())
  email?: string; // email

  @IsString()
  @ValidateIf(o => !o.technicianId)
  @IsNotEmpty()
  @Transform(({ value }) => value?.trim())
  username?: string;

  @IsString()
  @ValidateIf(o => !o.technicianId)
  @IsNotEmpty()
  phone?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim())
  @MaxLength(5)
  countryCode?: string;

  @IsString()
  @ValidateIf(o => !o.technicianId)
  @IsNotEmpty()
  @Transform(({ value }) => value?.trim())
  firstName?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim())
  lastName?: string;

  @IsString()
  @ValidateIf(o => !o.technicianId)
  @IsNotEmpty()
  @Transform(({ value }) => value?.trim())
  password?: string;

  // @IsOptional()
  // @Transform(({ value }) => {
  //   if (typeof value === 'string') {
  //     try {
  //       return JSON.parse(value);
  //     } catch {
  //       return value;
  //     }
  //   }
  //   return value;
  // })
  // @ValidateNested()
  // @Type(() => TechnicianProfileDto)
  // technicianProfile?: TechnicianProfileDto;

  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return plainToInstance(TechnicianProfileDto, JSON.parse(value));
    }
    return plainToInstance(TechnicianProfileDto, value);
  })
  @ValidateNested()
  technicianProfile?: TechnicianProfileDto;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim())
  technicianId?: string;

  // @IsOptional()
  // @Transform(({ value }) => {
  //   if (typeof value === 'string') {
  //     try {
  //       return JSON.parse(value);
  //     } catch {
  //       return value;
  //     }
  //   }
  //   return value;
  // })
  // @ValidateNested()
  // @Type(() => CustomerAddressDto)
  // customerAddress?: CustomerAddressDto;

  @IsOptional() 
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return plainToInstance(CustomerAddressDto, JSON.parse(value));
    }
    return plainToInstance(CustomerAddressDto, value);
  })
  @ValidateNested()
  customerAddress?: CustomerAddressDto;
}

export class UpdateCustomerAddressDto {
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
  @IsString()
  label?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
