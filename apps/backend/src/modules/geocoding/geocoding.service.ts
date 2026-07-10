import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { PrismaService } from '../../database/prisma.service';

const USER_AGENT = 'BloodDonationApp/1.0 contact@blooddonation.app';
const MIN_REQUEST_INTERVAL_MS = 1100; // Nominatim ToS: max 1 req/sec

interface GeocodeResult {
  lat: number;
  lng: number;
  displayName: string;
}

export interface PlaceSearchResult {
  lat: number;
  lng: number;
  displayName: string;
  shortName: string;
  state?: string;
}

function boundingBox(lat: number, lng: number, radiusKm: number): [number, number, number, number] {
  const latDelta = radiusKm / 111;
  const lngDelta = radiusKm / (111 * Math.cos((lat * Math.PI) / 180));
  return [lng - lngDelta, lat + latDelta, lng + lngDelta, lat - latDelta]; // left, top, right, bottom
}

@Injectable()
export class GeocodingService {
  private readonly logger = new Logger(GeocodingService.name);
  private lastRequestMs = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async reverseGeocode(lat: number, lng: number): Promise<string | null> {
    const cacheKey = `rev:${lat.toFixed(4)},${lng.toFixed(4)}`;
    const cached = await this.prisma.geocodeCache.findUnique({ where: { query: cacheKey } });
    if (cached) return cached.displayName;

    await this.throttle();
    try {
      const baseUrl = this.config.get<string>('app.nominatimBaseUrl');
      const { data } = await axios.get(`${baseUrl}/reverse`, {
        params: { lat, lon: lng, format: 'json' },
        headers: { 'User-Agent': USER_AGENT },
        timeout: 6000,
      });

      const addr = data?.address ?? {};
      const displayName: string =
        addr.suburb ?? addr.neighbourhood ?? addr.city_district ??
        addr.town ?? addr.city ?? data?.display_name ?? '';

      if (displayName) {
        await this.prisma.geocodeCache.create({
          data: { query: cacheKey, lat, lng, displayName },
        });
      }
      return displayName || null;
    } catch (err: any) {
      this.logger.warn(`Reverse geocode failed: ${err.message}`);
      return null;
    }
  }

  async geocode(query: string): Promise<GeocodeResult | null> {
    const key = query.toLowerCase().trim();
    const cached = await this.prisma.geocodeCache.findUnique({ where: { query: key } });
    if (cached) return { lat: cached.lat, lng: cached.lng, displayName: cached.displayName };

    await this.throttle();
    try {
      const baseUrl = this.config.get<string>('app.nominatimBaseUrl');
      const { data } = await axios.get(`${baseUrl}/search`, {
        params: { q: query, format: 'json', limit: 1, countrycodes: 'in' },
        headers: { 'User-Agent': USER_AGENT },
        timeout: 6000,
      });
      if (!data?.length) return null;

      const r = data[0];
      const result: GeocodeResult = {
        lat: parseFloat(r.lat),
        lng: parseFloat(r.lon),
        displayName: r.display_name,
      };
      await this.prisma.geocodeCache.upsert({
        where: { query: key },
        create: { query: key, ...result },
        update: { ...result },
      });
      return result;
    } catch (err: any) {
      this.logger.warn(`Geocode failed: ${err.message}`);
      return null;
    }
  }

  // Multi-result place search, scoped to a state — used for the
  // registration City picker. Not cached (GeocodeCache stores one
  // result per query key, not a list); relies on the throttle below
  // plus client-side debouncing to stay within Nominatim's rate limit.
  async searchCities(query: string, state: string, limit = 8): Promise<PlaceSearchResult[]> {
    if (!query || query.trim().length < 2) return [];
    await this.throttle();
    try {
      const baseUrl = this.config.get<string>('app.nominatimBaseUrl');
      const { data } = await axios.get(`${baseUrl}/search`, {
        params: {
          q: `${query}, ${state}, India`,
          format: 'json',
          addressdetails: 1,
          limit,
          countrycodes: 'in',
          dedupe: 1,
        },
        headers: { 'User-Agent': USER_AGENT },
        timeout: 6000,
      });
      if (!Array.isArray(data)) return [];
      return data.map((r: any) => this.toPlaceResult(r));
    } catch (err: any) {
      this.logger.warn(`City search failed: ${err.message}`);
      return [];
    }
  }

  // Multi-result place search, optionally biased to a radius around a
  // point — used for the hospital picker on request creation. lat/lng
  // are omitted when the receiver denied location permission, in which
  // case this falls back to an unbounded India-wide search rather than
  // blocking the feature entirely.
  async searchNearbyPlaces(
    query: string,
    lat?: number,
    lng?: number,
    radiusKm = 25,
    limit = 8,
  ): Promise<PlaceSearchResult[]> {
    if (!query || query.trim().length < 2) return [];
    await this.throttle();
    try {
      const baseUrl = this.config.get<string>('app.nominatimBaseUrl');
      const params: Record<string, string | number> = {
        q: query,
        format: 'json',
        addressdetails: 1,
        limit,
        countrycodes: 'in',
        dedupe: 1,
      };
      if (lat !== undefined && lng !== undefined) {
        const [left, top, right, bottom] = boundingBox(lat, lng, radiusKm);
        params.viewbox = `${left},${top},${right},${bottom}`;
        params.bounded = 1;
      }
      const { data } = await axios.get(`${baseUrl}/search`, {
        params,
        headers: { 'User-Agent': USER_AGENT },
        timeout: 6000,
      });
      if (!Array.isArray(data)) return [];
      return data.map((r: any) => this.toPlaceResult(r));
    } catch (err: any) {
      this.logger.warn(`Nearby place search failed: ${err.message}`);
      return [];
    }
  }

  private toPlaceResult(r: any): PlaceSearchResult {
    return {
      lat: parseFloat(r.lat),
      lng: parseFloat(r.lon),
      displayName: r.display_name,
      shortName: r.name || r.display_name.split(',')[0],
      state: r.address?.state,
    };
  }

  private async throttle(): Promise<void> {
    const elapsed = Date.now() - this.lastRequestMs;
    if (elapsed < MIN_REQUEST_INTERVAL_MS) {
      await new Promise((r) => setTimeout(r, MIN_REQUEST_INTERVAL_MS - elapsed));
    }
    this.lastRequestMs = Date.now();
  }
}
