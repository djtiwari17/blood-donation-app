import { Global, Module } from '@nestjs/common';
import { GeocodingService } from './geocoding.service';
import { GeocodingController } from './geocoding.controller';

@Global()
@Module({
  controllers: [GeocodingController],
  providers: [GeocodingService],
  exports: [GeocodingService],
})
export class GeocodingModule {}
