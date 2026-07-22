import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';

@Module({
  imports: [BullModule.registerQueue({ name: 'MATCH_REQUESTS' })],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
