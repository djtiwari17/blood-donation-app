export interface ISmsProvider {
  readonly name: string;
  send(to: string, message: string): Promise<void>;
}
