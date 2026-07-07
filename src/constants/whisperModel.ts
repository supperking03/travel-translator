import * as LegacyFS from 'expo-file-system/legacy';

export const WHISPER_MODEL_FILENAME = 'ggml-base-q5_1.bin';
export const WHISPER_MODEL_URL =
  'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base-q5_1.bin';
export const WHISPER_MODEL_SIZE_MB = 56;

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

// Strip Whisper non-speech annotations ([music], (laughs), ♪…♪) before translating.
export function stripWhisperNoise(text: string): string {
  return text
    .replace(/\[[^\]]*\]/g, '')
    .replace(/\([^)]{1,40}\)/g, '')
    .replace(/♪[^♪]*♪?/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
