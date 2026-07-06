import { IsDateString, IsEnum, IsOptional, IsString, Length } from 'class-validator';
import { Gender } from '@prisma/client';

export class UpdateUserDto {
  @IsString()
  @IsOptional()
  @Length(2, 100)
  name?: string;

  @IsEnum(Gender)
  @IsOptional()
  gender?: Gender;

  @IsDateString()
  @IsOptional()
  dateOfBirth?: string;

  @IsString()
  @IsOptional()
  @Length(2, 100)
  city?: string;

  @IsString()
  @IsOptional()
  @Length(2, 100)
  area?: string;

  @IsString()
  @IsOptional()
  fcmToken?: string;
}
