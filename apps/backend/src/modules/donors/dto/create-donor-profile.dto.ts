import {
  IsBoolean, IsDateString, IsNumber, IsOptional, IsEnum, Max, Min,
} from 'class-validator';
import { Gender } from '@prisma/client';

export class CreateDonorProfileDto {
  @IsBoolean()
  @IsOptional()
  isAvailable?: boolean;

  @IsDateString()
  @IsOptional()
  lastDonationDate?: string;

  @IsNumber()
  @Min(-90)
  @Max(90)
  @IsOptional()
  locationLat?: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  @IsOptional()
  locationLng?: number;

  // User fields collected during donor setup (stored on User model)
  @IsEnum(Gender)
  @IsOptional()
  gender?: Gender;

  @IsDateString()
  @IsOptional()
  dateOfBirth?: string;
}
