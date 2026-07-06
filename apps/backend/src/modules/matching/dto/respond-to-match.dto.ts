import { IsEnum } from 'class-validator';

export enum MatchAction {
  ACCEPT = 'ACCEPT',
  DECLINE = 'DECLINE',
}

export class RespondToMatchDto {
  @IsEnum(MatchAction)
  action: MatchAction;
}
