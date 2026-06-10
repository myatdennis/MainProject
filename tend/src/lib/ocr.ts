import { Platform, NativeModules } from 'react-native';

export interface OcrResult {
  text: string;
  confidence: number;
  boundingBoxes: Array<{
    text: string;
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
}

// Native module interface — requires TendOCR native module in prod
const TendOCR: {
  recognizeImage?: (base64: string) => Promise<OcrResult>;
} = NativeModules.TendOCR ?? {};

export async function recognizeHandwriting(base64Image: string): Promise<OcrResult> {
  if (Platform.OS !== 'ios' || !TendOCR.recognizeImage) {
    return mockOcr(base64Image);
  }

  try {
    return await TendOCR.recognizeImage(base64Image);
  } catch {
    return { text: '', confidence: 0, boundingBoxes: [] };
  }
}

// Simulator/Android mock — returns placeholder so UI flows correctly
function mockOcr(_base64: string): Promise<OcrResult> {
  return Promise.resolve({
    text: '',
    confidence: 0,
    boundingBoxes: [],
  });
}

export function isOcrAvailable(): boolean {
  return Platform.OS === 'ios' && !!TendOCR.recognizeImage;
}
