import * as LegacyFS from 'expo-file-system/legacy';

export const WHISPER_MODEL_FILENAME = 'ggml-base.bin';
export const WHISPER_MODEL_URL =
  'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin';
export const WHISPER_MODEL_SIZE_MB = 142;

export const getWhisperModelDir = () => `${LegacyFS.documentDirectory}whisper/`;
export const getWhisperModelPath = () =>
  `${LegacyFS.documentDirectory}whisper/${WHISPER_MODEL_FILENAME}`;

const WHISPER_LANG_MAP: Record<string, string> = {
  'zh-tw': 'zh',
  yue:     'zh',
  fil:     'tl',
};

export const getWhisperLang = (langCode: string): string =>
  WHISPER_LANG_MAP[langCode] ?? langCode;
