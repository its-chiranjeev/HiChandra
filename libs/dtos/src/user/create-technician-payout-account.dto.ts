import {
  IsEnum,
  IsOptional,
  IsString,
  ValidateIf,
} from 'class-validator';

import {
  PAYOUT_ACCOUNT_TYPE,
} from '@hichandra/entities';

export class CreateTechnicianPayoutAccountDto {
  @IsEnum(PAYOUT_ACCOUNT_TYPE)
  accountType!: PAYOUT_ACCOUNT_TYPE;

  @ValidateIf(
    (dto) =>
      dto.accountType ===
      PAYOUT_ACCOUNT_TYPE.VPA,
  )
  @IsString()
  upiId?: string;

  @ValidateIf(
    (dto) =>
      dto.accountType ===
      PAYOUT_ACCOUNT_TYPE.BANK_ACCOUNT,
  )
  @IsString()
  accountHolderName?: string;

  @ValidateIf(
    (dto) =>
      dto.accountType ===
      PAYOUT_ACCOUNT_TYPE.BANK_ACCOUNT,
  )
  @IsOptional()
  @IsString()
  bankName?: string;

  @ValidateIf(
    (dto) =>
      dto.accountType ===
      PAYOUT_ACCOUNT_TYPE.BANK_ACCOUNT,
  )
  @IsString()
  accountNumber?: string;

  @ValidateIf(
    (dto) =>
      dto.accountType ===
      PAYOUT_ACCOUNT_TYPE.BANK_ACCOUNT,
  )
  @IsString()
  ifscCode?: string;
}