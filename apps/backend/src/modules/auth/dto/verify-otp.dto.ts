import { IsString, Length, Matches } from 'class-validator';

export class VerifyOtpDto {
  @IsString()
  @Matches(/^\+91[6-9]\d{9}$/, { message: 'Phone must be a valid Indian mobile number' })
  phone: string;

  @IsString()
  @Length(6, 6, { message: 'OTP must be exactly 6 digits' })
  @Matches(/^\d{6}$/, { message: 'OTP must contain digits only' })
  code: string;
}
