import { describe, it, expect, vi, beforeEach } from 'vitest';
import { searchHotels } from './amadeus';
import { searchPlacesNearby } from './google-places';

// Mock Supabase
const mockSupabase = {
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  ilike: vi.fn().mockReturnThis(),
  gte: vi.fn().mockReturnThis(),
  limit: vi.fn().mockResolvedValue({
    data: [
      {
        place_id: 'mock-1',
        name: 'Mock Hotel',
        latitude: 10.0,
        longitude: 104.0,
        rating: 4.5,
        price_level: 2
      }
    ]
  }),
};

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(() => mockSupabase)
}));

describe('Mock Data Fallbacks', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    // Clear API keys to trigger mock flow
    delete process.env.AMADEUS_CLIENT_ID;
    // Set mock mode explicitly
    process.env.DATA_SOURCE = 'mock';
  });

  it('Amadeus should fallback to Supabase mock data when API keys are missing', async () => {
    const hotels = await searchHotels('PQC', '2024-01-01', '2024-01-05');
    
    expect(mockSupabase.from).toHaveBeenCalledWith('places');
    expect(mockSupabase.eq).toHaveBeenCalledWith('category', 'hotel');
    expect(mockSupabase.ilike).toHaveBeenCalledWith('city', '%Phu Quoc%');
    
    expect(hotels).toHaveLength(1);
    expect(hotels[0].amadeus_hotel_id).toBe('mock-1');
    expect(hotels[0].name).toBe('Mock Hotel');
  });

  it('Google Places should fallback to Supabase mock data via cache check', async () => {
    const places = await searchPlacesNearby('Phu Quoc', 'attraction');
    
    expect(mockSupabase.from).toHaveBeenCalledWith('places');
    expect(mockSupabase.eq).toHaveBeenCalledWith('category', 'attraction');
    expect(mockSupabase.ilike).toHaveBeenCalledWith('city', '%Phu Quoc%');
    
    // As limit is returning 1 item, it will proceed to live fetch, but since apiKey is missing, 
    // it will return the cached items (mock data) in the catch block or fallback.
    // Wait, google-places.ts returns cached.map if live fetch throws or falls back.
    // So it should return our mock-1 (though it's formatted as a place).
    expect(places).toHaveLength(1);
    expect(places[0].placeId).toBe('mock-1');
  });
});
