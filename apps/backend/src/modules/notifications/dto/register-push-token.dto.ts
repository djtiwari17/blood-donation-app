import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RegisterPushTokenDto {
  @IsString()
  @MaxLength(255)
  token: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  platform?: string;
}
