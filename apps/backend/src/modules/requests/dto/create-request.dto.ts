import {
  IsString, IsNumber, IsEnum, IsOptional,
  IsDateString, Min, Max, IsNotEmpty,
} from 'class-validator';
import { UrgencyLevel } from '@prisma/client';

export class CreateRequestDto {
  @IsString()
  @IsNotEmpty()
  patientName: string;

  @IsString()
  @IsNotEmpty()
  hospitalName: string;

  @IsString()
  @IsNotEmpty()
  bloodGroup: string; // Display format: 'A+', 'B-', etc.

  @IsNumber()
  @Min(1)
  @Max(10)
  unitsNeeded: number;

  @IsEnum(UrgencyLevel)
  urgency: UrgencyLevel;

  @IsDateString()
  requiredBy: string; // ISO 8601

  @IsString()
  @IsOptional()
  hospitalAddress?: string; // Geocoded if lat/lng not provided

  @IsNumber()
  @IsOptional()
  hospitalLat?: number;

  @IsNumber()
  @IsOptional()
  hospitalLng?: number;
}
