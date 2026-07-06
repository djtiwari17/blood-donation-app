import { Module } from '@nestjs/common';
import { DonorsService } from './donors.service';
import { DonorsController } from './donors.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  providers: [DonorsService],
  controllers: [DonorsController],
  exports: [DonorsService],
})
export class DonorsModule {}
