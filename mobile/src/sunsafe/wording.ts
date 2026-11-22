/**
 * SunSafe wording. DRAFT for review by the LUMA healthcare lead before the
 * pilot: short, practical and non-diagnostic. No medical claims, no skin
 * assessment. Edit here only; the app and docs read from this file.
 */
export const REMINDER_MESSAGES = [
  'Sun protection: put on your hat and long sleeves before you go out.',
  'Sun check: use sunscreen and take your hat with you.',
  'The midday sun is strong. Stay in the shade when you can.',
] as const;

export type UvLevel = 'low' | 'moderate' | 'high' | 'very_high' | 'extreme';

/** WHO UV index categories. */
export function uvLevel(uv: number): UvLevel {
  if (uv < 3) return 'low';
  if (uv < 6) return 'moderate';
  if (uv < 8) return 'high';
  if (uv < 11) return 'very_high';
  return 'extreme';
}

export const UV_LABEL: Record<UvLevel, string> = {
  low: 'Low',
  moderate: 'Moderate',
  high: 'High',
  very_high: 'Very high',
  extreme: 'Extreme',
};

export const UV_ADVICE: Record<UvLevel, string> = {
  low: 'Cover up if you will be outside for a long time.',
  moderate: 'Wear a hat and long sleeves outside, and use sunscreen.',
  high: 'Cover up, use sunscreen and stay in the shade around midday.',
  very_high: 'Stay in the shade around midday. Cover up and use sunscreen.',
  extreme: 'Stay indoors or in the shade around midday if you can. Cover up fully outside.',
};
