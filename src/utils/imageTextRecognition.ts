import { NativeModules, Platform } from 'react-native';

export type TextBlock = {
  text:   string;
  x:      number; // normalized 0–1, top-left origin
  y:      number;
  width:  number;
  height: number;
};

type TextRecognitionModuleShape = {
  recognizeText:          (imageUri: string, sourceLangCode?: string) => Promise<string>;
  recognizeTextWithBoxes: (imageUri: string, sourceLangCode?: string) => Promise<TextBlock[]>;
};

const { TextRecognitionModule } = NativeModules as {
  TextRecognitionModule?: TextRecognitionModuleShape;
};

function assertAvailable(): TextRecognitionModuleShape {
  if (Platform.OS !== 'ios') {
    throw new Error('Offline image text recognition is available on iOS only.');
  }
  if (!TextRecognitionModule) {
    throw new Error('TextRecognitionModule is not available.');
  }
  return TextRecognitionModule;
}

export async function recognizeTextFromImage(imageUri: string, sourceLangCode?: string): Promise<string> {
  return assertAvailable().recognizeText(imageUri, sourceLangCode);
}

export async function recognizeTextBlocksFromImage(imageUri: string, sourceLangCode?: string): Promise<TextBlock[]> {
  return assertAvailable().recognizeTextWithBoxes(imageUri, sourceLangCode);
}
