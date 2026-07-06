import {
  IsString, IsNotEmpty, IsIn, IsEnum, IsOptional, Length, IsDateString,
} from 'class-validator';
import { Gender } from '@prisma/client';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;
const ALLOWED_ROLES = ['DONOR', 'RECEIVER', 'DONOR_RECEIVER'] as const;

export class RegisterDto {
  @IsString()
  @IsNotEmpty()
  otpSession: string;

  @IsString()
  @IsNotEmpty()
  @Length(2, 100)
  name: string;

  @IsIn(BLOOD_GROUPS)
  bloodGroup: string;

  @IsEnum(Gender)
  @IsOptional()
  gender?: Gender;

  @IsIn(ALLOWED_ROLES)
  @IsOptional()
  role?: string;

  @IsDateString()
  @IsOptional()
  dateOfBirth?: string;

  @IsString()
  @IsOptional()
  @Length(2, 100)
  city?: string;
}
