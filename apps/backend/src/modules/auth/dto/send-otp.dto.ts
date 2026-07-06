import { IsString, Matches } from 'class-validator';

export class SendOtpDto {
  @IsString()
  @Matches(/^\+\d{7,15}$/, {
    message: 'Phone must be in E.164 format, e.g. +919876543210',
  })
  phone: string;
}
