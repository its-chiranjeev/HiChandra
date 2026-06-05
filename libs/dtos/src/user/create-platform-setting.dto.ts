import { Transform } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { PLATFORM_SETTING_KEYS } from '@hichandra/entities';

export class CreatePlatformSettingDto {
  @IsEnum(PLATFORM_SETTING_KEYS)
  @IsNotEmpty()
  key!: PLATFORM_SETTING_KEYS;

  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  value!: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  description?: string;
}
