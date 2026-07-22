import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export enum ModerationAction {
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
  VERIFY = 'VERIFY',
  MARK_FAKE = 'MARK_FAKE',
}

export class ModerateRequestDto {
  @IsEnum(ModerationAction)
  action: ModerationAction;

  // Optional reason shown to the requester (for REJECT / MARK_FAKE).
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}
