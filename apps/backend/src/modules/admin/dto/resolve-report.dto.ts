import { IsString, MaxLength, MinLength } from 'class-validator';

export class ResolveReportDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  resolution: string;
}
