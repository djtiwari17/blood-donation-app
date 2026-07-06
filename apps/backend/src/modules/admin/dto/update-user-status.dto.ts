import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { VerifStatus } from '@prisma/client';

export class UpdateUserStatusDto {
  @IsOptional()
  @IsEnum(VerifStatus)
  verifStatus?: VerifStatus;

  @IsOptional()
  @IsBoolean()
  isBlocked?: boolean;
}
