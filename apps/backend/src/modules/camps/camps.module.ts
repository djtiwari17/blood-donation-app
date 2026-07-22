import { Module } from '@nestjs/common';
import { CampsService } from './camps.service';
import { CampsScheduler } from './camps.scheduler';
import { CampsController, AdminCampsController } from './camps.controller';

@Module({
  providers: [CampsService, CampsScheduler],
  controllers: [CampsController, AdminCampsController],
  exports: [CampsService],
})
export class CampsModule {}
