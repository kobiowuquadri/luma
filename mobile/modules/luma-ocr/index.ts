import { requireOptionalNativeModule } from 'expo';

/** Raw output of the native module. Boxes are in saved-image pixels. */
export interface RawBox {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface RawElement {
  text: string;
  box: RawBox | null;
  confidence: number | null;
}

export interface RawLine {
  text: string;
  box: RawBox | null;
  angle: number | null;
  confidence: number | null;
  language: string | null;
  elements: RawElement[];
}

export interface RawBlock {
  text: string;
  box: RawBox | null;
  language: string | null;
  lines: RawLine[];
}

export interface PhotoQuality {
  sharpness: number;
  brightness: number;
  contrast: number;
  glare: number;
}

export interface RawRecognition {
  width: number;
  height: number;
  imageUri: string;
  quality: PhotoQuality;
  blocks: RawBlock[];
  durationMs: number;
}

export interface DeviceVoice {
  name: string;
  locale: string;
  language: string;
  networkRequired: boolean;
  notInstalled: boolean;
  quality: number;
}

export interface DeviceVoiceList {
  ok: boolean;
  engine: string | null;
  voices: DeviceVoice[];
}

interface NativeLumaOcr {
  engine: string;
  recognizeAsync(sourceUri: string, outputPath: string, maxDimension: number): Promise<string>;
  listVoicesAsync(): Promise<string>;
}

const native = requireOptionalNativeModule<NativeLumaOcr>('LumaOcr');

/** False in Expo Go or on platforms without the LUMA native build. */
export const isOcrAvailable = native != null;

export const ocrEngine = native?.engine ?? 'unavailable';

/**
 * Recognise text in an image and save an upright, metadata-free copy to
 * outputUri (a file:// URI inside the app's private storage).
 */
export async function recognizeImage(sourceUri: string, outputUri: string, maxDimension = 3000): Promise<RawRecognition> {
  if (!native) {
    throw new Error('OCR_UNAVAILABLE');
  }
  const json = await native.recognizeAsync(sourceUri, outputUri, maxDimension);
  return JSON.parse(json) as RawRecognition;
}

/** List installed text-to-speech voices with network/installed flags. */
export async function listDeviceVoices(): Promise<DeviceVoiceList> {
  if (!native) {
    return { ok: false, engine: null, voices: [] };
  }
  return JSON.parse(await native.listVoicesAsync()) as DeviceVoiceList;
}
