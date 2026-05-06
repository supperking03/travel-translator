import { NativeModules, Platform } from 'react-native';

type TextRecognitionModuleShape = {
  recognizeText: (imageUri: string) => Promise<string>;
};

const { TextRecognitionModule } = NativeModules as {
  TextRecognitionModule?: TextRecognitionModuleShape;
};

export async function recognizeTextFromImage(imageUri: string): Promise<string> {
  if (Platform.OS !== 'ios') {
    throw new Error('Offline image text recognition is currently available on iOS only.');
  }

  if (!TextRecognitionModule?.recognizeText) {
    throw new Error('Text recognition module is not available.');
  }

  return TextRecognitionModule.recognizeText(imageUri);
}
