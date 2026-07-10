import { apiClient } from './client';

export interface PlaceResult {
  lat: number;
  lng: number;
  displayName: string;
  shortName: string;
  state?: string;
}

export const geocodingApi = {
  // Public — used during registration, before the user has an access token.
  async searchCities(query: string, state: string): Promise<PlaceResult[]> {
    const res = await apiClient.get('/geocoding/cities', { params: { q: query, state } });
    return res.data.data;
  },

  async searchHospitals(query: string, lat?: number, lng?: number): Promise<PlaceResult[]> {
    const res = await apiClient.get('/geocoding/hospitals', { params: { q: query, lat, lng } });
    return res.data.data;
  },
};
