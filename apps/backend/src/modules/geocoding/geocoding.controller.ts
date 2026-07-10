import { Controller, Get, Query, UseGuards, BadRequestException } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { GeocodingService } from './geocoding.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('geocoding')
export class GeocodingController {
  constructor(private readonly geocoding: GeocodingService) {}

  // Public: used during registration, before the user has an access token.
  @Get('cities')
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  searchCities(@Query('q') q: string, @Query('state') state: string) {
    if (!state) throw new BadRequestException('state is required');
    return this.geocoding.searchCities(q, state);
  }

  // Authenticated: used on request creation, biased near the receiver's
  // current GPS location.
  @Get('hospitals')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  searchHospitals(
    @Query('q') q: string,
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
  ) {
    const latNum = lat !== undefined ? parseFloat(lat) : undefined;
    const lngNum = lng !== undefined ? parseFloat(lng) : undefined;
    if ((latNum !== undefined && Number.isNaN(latNum)) || (lngNum !== undefined && Number.isNaN(lngNum))) {
      throw new BadRequestException('lat and lng must be valid numbers');
    }
    return this.geocoding.searchNearbyPlaces(q, latNum, lngNum);
  }
}
