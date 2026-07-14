import {
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';

import {
  PAYOUT_ACCOUNT_TYPE,
} from '@hichandra/entities';

export class UpdateTechnicianPayoutAccountDto {
  @IsOptional()
  @IsEnum(PAYOUT_ACCOUNT_TYPE)
  accountType?: PAYOUT_ACCOUNT_TYPE;

  @IsOptional()
  @IsString()
  upiId?: string;

  @IsOptional()
  @IsString()
  accountHolderName?: string;

  @IsOptional()
  @IsString()
  bankName?: string;

  @IsOptional()
  @IsString()
  accountNumber?: string;

  @IsOptional()
  @IsString()
  ifscCode?: string;
}