import { IsBoolean, IsDateString, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class UpdateDonorProfileDto {
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
}
