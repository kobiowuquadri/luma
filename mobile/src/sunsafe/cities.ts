/** Cities a student can choose for the UV forecast. No location permission is used. */
export interface City {
  id: string;
  name: string;
  state: string;
  lat: number;
  lon: number;
}

export const CITIES: City[] = [
  { id: 'abuja', name: 'Abuja', state: 'FCT', lat: 9.0765, lon: 7.3986 },
  { id: 'lagos', name: 'Lagos', state: 'Lagos', lat: 6.5244, lon: 3.3792 },
  { id: 'ibadan', name: 'Ibadan', state: 'Oyo', lat: 7.3775, lon: 3.947 },
  { id: 'kano', name: 'Kano', state: 'Kano', lat: 12.0022, lon: 8.592 },
  { id: 'kaduna', name: 'Kaduna', state: 'Kaduna', lat: 10.5105, lon: 7.4165 },
  { id: 'port-harcourt', name: 'Port Harcourt', state: 'Rivers', lat: 4.8156, lon: 7.0498 },
  { id: 'enugu', name: 'Enugu', state: 'Enugu', lat: 6.4584, lon: 7.5464 },
  { id: 'benin-city', name: 'Benin City', state: 'Edo', lat: 6.335, lon: 5.6037 },
  { id: 'jos', name: 'Jos', state: 'Plateau', lat: 9.8965, lon: 8.8583 },
  { id: 'ilorin', name: 'Ilorin', state: 'Kwara', lat: 8.4966, lon: 4.5421 },
  { id: 'maiduguri', name: 'Maiduguri', state: 'Borno', lat: 11.8333, lon: 13.15 },
  { id: 'sokoto', name: 'Sokoto', state: 'Sokoto', lat: 13.0059, lon: 5.2476 },
  { id: 'owerri', name: 'Owerri', state: 'Imo', lat: 5.4836, lon: 7.0333 },
  { id: 'calabar', name: 'Calabar', state: 'Cross River', lat: 4.9757, lon: 8.3417 },
  { id: 'abeokuta', name: 'Abeokuta', state: 'Ogun', lat: 7.1475, lon: 3.3619 },
  { id: 'akure', name: 'Akure', state: 'Ondo', lat: 7.2571, lon: 5.2058 },
  { id: 'osogbo', name: 'Osogbo', state: 'Osun', lat: 7.7827, lon: 4.5418 },
  { id: 'uyo', name: 'Uyo', state: 'Akwa Ibom', lat: 5.0377, lon: 7.9128 },
  { id: 'yola', name: 'Yola', state: 'Adamawa', lat: 9.2035, lon: 12.4954 },
  { id: 'zaria', name: 'Zaria', state: 'Kaduna', lat: 11.0855, lon: 7.7199 },
];

export function cityById(id: string | null | undefined): City | null {
  return CITIES.find((c) => c.id === id) ?? null;
}
