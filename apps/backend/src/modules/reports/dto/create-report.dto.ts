import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ReportReason } from '@prisma/client';

export class CreateReportDto {
  @IsUUID()
  reportedUserId: string;

  @IsEnum(ReportReason)
  reason: ReportReason;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  details?: string;
}
