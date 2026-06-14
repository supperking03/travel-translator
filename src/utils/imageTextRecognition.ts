import { Image, NativeModules, Platform } from 'react-native';

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

type MlKitFrame = {
  left?: number;
  top?: number;
  width?: number;
  height?: number;
};

type MlKitTextBlock = {
  text?: string;
  frame?: MlKitFrame;
};

type MlKitRecognitionResult = {
  text?: string;
  blocks?: MlKitTextBlock[];
};

type MlKitTextRecognitionModule = {
  recognize: (imageUri: string, script?: string) => Promise<MlKitRecognitionResult>;
};

const { TextRecognitionModule } = NativeModules as {
  TextRecognitionModule?: TextRecognitionModuleShape;
};

function assertIosAvailable(): TextRecognitionModuleShape {
  if (Platform.OS !== 'ios') {
    throw new Error('Offline image text recognition is available on iOS only.');
  }
  if (!TextRecognitionModule) {
    throw new Error('TextRecognitionModule is not available.');
  }
  return TextRecognitionModule;
}

function getMlKitTextRecognition(): MlKitTextRecognitionModule {
  try {
    // Lazy require so old binaries without the native module fail gracefully.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@react-native-ml-kit/text-recognition');
    return mod.default ?? mod;
  } catch {
    throw new Error('Android image text recognition is not installed. Install @react-native-ml-kit/text-recognition and rebuild the app.');
  }
}

function getImageSize(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      () => resolve({ width: 1, height: 1 }),
    );
  });
}

function mlKitScriptForLanguage(language?: string) {
  if (!language) return undefined;
  if (['zh', 'zh-cn', 'zh-tw'].includes(language.toLowerCase())) return 'Chinese';
  if (language.toLowerCase() === 'ja') return 'Japanese';
  if (language.toLowerCase() === 'ko') return 'Korean';
  return undefined;
}

function blockFromMlKit(block: MlKitTextBlock, imageWidth: number, imageHeight: number): TextBlock | null {
  const text = block.text?.trim();
  if (!text) return null;

  const frame = block.frame;
  if (!frame || !imageWidth || !imageHeight) {
    return { text, x: 0, y: 0, width: 1, height: 0.08 };
  }

  return {
    text,
    x: Math.max(0, (frame.left ?? 0) / imageWidth),
    y: Math.max(0, (frame.top ?? 0) / imageHeight),
    width: Math.min(1, Math.max(0.01, (frame.width ?? imageWidth) / imageWidth)),
    height: Math.min(1, Math.max(0.01, (frame.height ?? imageHeight) / imageHeight)),
  };
}

export async function recognizeTextFromImage(imageUri: string, sourceLangCode?: string): Promise<string> {
  if (Platform.OS === 'ios') {
    return assertIosAvailable().recognizeText(imageUri, sourceLangCode);
  }

  const result = await getMlKitTextRecognition().recognize(imageUri, mlKitScriptForLanguage(sourceLangCode));
  const blocks = result.blocks ?? [];
  const text = blocks.length
    ? blocks.map((block) => block.text?.trim()).filter(Boolean).join('\n\n')
    : result.text ?? '';
  return text.replace(/\n{3,}/g, '\n\n').trim();
}

export async function recognizeTextBlocksFromImage(imageUri: string, sourceLangCode?: string): Promise<TextBlock[]> {
  if (Platform.OS === 'ios') {
    return assertIosAvailable().recognizeTextWithBoxes(imageUri, sourceLangCode);
  }

  const [{ width, height }, result] = await Promise.all([
    getImageSize(imageUri),
    getMlKitTextRecognition().recognize(imageUri, mlKitScriptForLanguage(sourceLangCode)),
  ]);

  const blocks = (result.blocks ?? [])
    .map((block) => blockFromMlKit(block, width, height))
    .filter((block): block is TextBlock => Boolean(block));

  if (blocks.length > 0) return blocks;

  const text = result.text?.trim();
  return text ? [{ text, x: 0.05, y: 0.05, width: 0.9, height: 0.12 }] : [];
}
