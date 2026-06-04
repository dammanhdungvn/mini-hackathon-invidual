import * as fs from 'fs';
import * as path from 'path';

interface MockHotel {
  id: string;
  name: string;
  area: string;
  price_tier: string;
  est_price_vnd: number;
  usp: string;
  room_types: string[];
  amenities: string[];
}

const mockHotelsPath = path.join(__dirname, 'mock-hotels.json');
const mockHotelsData: MockHotel[] = JSON.parse(fs.readFileSync(mockHotelsPath, 'utf8'));

const BASE_LAT = 10.2222;
const BASE_LNG = 103.9631;

const priceTierToLevel: Record<string, number> = {
  'Tiết kiệm': 1,
  'Tầm trung': 2,
  'Cao cấp': 4
};

function escapeSql(str: string): string {
  return str.replace(/'/g, "''");
}

async function seed() {
  console.log("Generating supabase/seed.sql...");
  let sql = `-- Seed file generated from data_hotel.py\n\n`;

  const places: any[] = [];

  mockHotelsData.forEach((h) => {
    places.push({
      place_id: `mock-hotel-${h.id}`,
      name: h.name,
      category: 'hotel',
      city: 'Phu Quoc',
      latitude: BASE_LAT + (Math.random() * 0.1 - 0.05),
      longitude: BASE_LNG + (Math.random() * 0.1 - 0.05),
      address: h.area,
      rating: +(4.0 + Math.random() * 1.0).toFixed(1),
      price_level: priceTierToLevel[h.price_tier] || 2,
      summary: `${h.usp}\nAmenities: ${h.amenities.join(', ')}\nRoom Types: ${h.room_types.join(', ')}`,
      last_fetched: new Date().toISOString()
    });
  });

  const mockAttractions = [
    { name: "VinWonders Phu Quoc", rating: 4.8 },
    { name: "Grand World Phu Quoc", rating: 4.6 },
    { name: "Phu Quoc Night Market", rating: 4.4 },
    { name: "Hon Thom Cable Car", rating: 4.9 },
    { name: "Sao Beach (Bai Sao)", rating: 4.7 },
    { name: "Ho Quoc Pagoda", rating: 4.5 },
    { name: "Safari Phu Quoc", rating: 4.8 }
  ];

  mockAttractions.forEach((a, i) => {
    places.push({
      place_id: `mock-attraction-${i}`,
      name: a.name,
      category: 'attraction',
      city: 'Phu Quoc',
      latitude: BASE_LAT + (Math.random() * 0.2 - 0.1),
      longitude: BASE_LNG + (Math.random() * 0.2 - 0.1),
      address: "Phu Quoc, Vietnam",
      rating: a.rating,
      price_level: 2,
      summary: `Experience the best of ${a.name}, a top-rated destination in Phu Quoc offering unforgettable views and engaging activities. Highly recommended for travelers.`,
      last_fetched: new Date().toISOString()
    });
  });

  const mockRestaurants = [
    { name: "Xin Chao Seafood Restaurant", rating: 4.5 },
    { name: "Crab House Phu Quoc", rating: 4.4 },
    { name: "Bup Restaurant", rating: 4.3 },
    { name: "The Peppertree Restaurant", rating: 4.7 },
    { name: "Nemo Restaurant", rating: 4.2 }
  ];

  mockRestaurants.forEach((r, i) => {
    places.push({
      place_id: `mock-restaurant-${i}`,
      name: r.name,
      category: 'restaurant',
      city: 'Phu Quoc',
      latitude: BASE_LAT + (Math.random() * 0.1 - 0.05),
      longitude: BASE_LNG + (Math.random() * 0.1 - 0.05),
      address: "Phu Quoc, Vietnam",
      rating: r.rating,
      price_level: 3,
      summary: `A highly rated restaurant in Phu Quoc serving authentic local flavors and fresh seafood in a beautiful setting.`,
      last_fetched: new Date().toISOString()
    });
  });

  const openingHours = '{"mon": ["00:00", "23:59"], "tue": ["00:00", "23:59"], "wed": ["00:00", "23:59"], "thu": ["00:00", "23:59"], "fri": ["00:00", "23:59"], "sat": ["00:00", "23:59"], "sun": ["00:00", "23:59"]}';

  places.forEach(p => {
    sql += `INSERT INTO public.places (place_id, name, category, city, latitude, longitude, address, rating, price_level, summary, opening_hours, last_fetched) `;
    sql += `VALUES ('${escapeSql(p.place_id)}', '${escapeSql(p.name)}', '${escapeSql(p.category)}', '${escapeSql(p.city)}', ${p.latitude}, ${p.longitude}, '${escapeSql(p.address)}', ${p.rating}, ${p.price_level}, '${escapeSql(p.summary)}', '${openingHours}', '${p.last_fetched}') `;
    sql += `ON CONFLICT (place_id) DO UPDATE SET name=EXCLUDED.name, category=EXCLUDED.category, city=EXCLUDED.city, latitude=EXCLUDED.latitude, longitude=EXCLUDED.longitude, address=EXCLUDED.address, rating=EXCLUDED.rating, price_level=EXCLUDED.price_level, summary=EXCLUDED.summary, opening_hours=EXCLUDED.opening_hours, last_fetched=EXCLUDED.last_fetched;\n`;
  });

  fs.writeFileSync(path.join(__dirname, '..', 'supabase', 'seed.sql'), sql);
  console.log(`Successfully wrote ${places.length} mock records to supabase/seed.sql`);
}

seed();
