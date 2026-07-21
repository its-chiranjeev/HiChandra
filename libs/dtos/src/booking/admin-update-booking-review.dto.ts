import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { REVIEW_STATUS } from '@hichandra/entities';

export class AdminUpdateBookingReviewDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  customerRating?: number;

  @IsOptional()
  @IsString()
  customerReview?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  technicianRating?: number;

  @IsOptional()
  @IsString()
  technicianReview?: string;

  @IsOptional()
  @IsEnum(REVIEW_STATUS)
  reviewStatus?: REVIEW_STATUS;
}
