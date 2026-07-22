import {
  IsString, IsOptional, IsNumber, IsDateString, MaxLength, MinLength,
} from 'class-validator';

export class CreateCampDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  tagline?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(300)
  venue: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @IsOptional()
  @IsNumber()
  lat?: number;

  @IsOptional()
  @IsNumber()
  lng?: number;

  @IsDateString()
  startTime: string;

  @IsDateString()
  endTime: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  organizer?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  contactPhone?: string;
}
