// One-off: geocode raw locations via Nominatim (1 req/s) -> src/locations.json
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
const raw = JSON.parse(readFileSync(new URL('./locations.raw.json', import.meta.url)));
const outPath = new URL('../src/locations.json', import.meta.url);
const cache = existsSync(outPath) ? Object.fromEntries(JSON.parse(readFileSync(outPath)).map(l => [l.address + l.city, l])) : {};
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function q(params) {
  const url = 'https://nominatim.openstreetmap.org/search?' + new URLSearchParams({ format: 'json', limit: 1, countrycodes: 'us', ...params });
  const res = await fetch(url, { headers: { 'User-Agent': 'salad-n-go-map-build/1.0' } });
  await sleep(1100);
  const j = await res.json();
  return j[0] ? [+j[0].lat, +j[0].lon] : null;
}
const out = [];
for (const [city, address, brand, pending] of raw) {
  const hit = cache[address + city];
  let coords = hit?.lat ? [hit.lat, hit.lng] : null;
  let precision = hit?.precision;
  if (!coords) {
    const street = address.replace(' & ', ' and ');
    coords = await q({ street, city, state: 'AZ' }); precision = 'address';
    if (!coords) { coords = await q({ q: `${address}, ${city}, AZ` }); precision = 'address'; }
    if (!coords) { coords = await q({ street: address.replace(/^\d+\s+/, ''), city, state: 'AZ' }); precision = 'street'; }
    if (!coords) { coords = await q({ city, state: 'AZ' }); precision = 'city'; }
  }
  console.log(precision.padEnd(8), city, '|', address, coords);
  out.push({ city, address, brand, pending: !!pending, lat: coords[0], lng: coords[1], precision });
}
writeFileSync(outPath, JSON.stringify(out, null, 1));
