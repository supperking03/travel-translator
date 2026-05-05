export interface Language {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
  // Name used in translation prompt (matches HY-MT1.5 training data)
  promptName: string;
  // BCP-47 locale for iOS AVSpeechSynthesizer; null = not supported by iOS TTS
  ttsLocale: string | null;
  // True for Chinese-family languages (uses Chinese instruction in prompt)
  isChinese?: boolean;
}

// All 33+ languages supported by Hy-MT1.5-1.8B
// Ordered by travel usefulness
export const LANGUAGES: Language[] = [
  { code: 'en',    name: 'English',            nativeName: 'English',           flag: '🇬🇧', promptName: 'English',      ttsLocale: 'en-US' },
  { code: 'zh',    name: 'Chinese',            nativeName: '中文',              flag: '🇨🇳', promptName: '中文',         ttsLocale: 'zh-CN', isChinese: true },
  { code: 'vi',    name: 'Vietnamese',         nativeName: 'Tiếng Việt',        flag: '🇻🇳', promptName: 'Vietnamese',   ttsLocale: 'vi-VN' },
  { code: 'ja',    name: 'Japanese',           nativeName: '日本語',            flag: '🇯🇵', promptName: 'Japanese',     ttsLocale: 'ja-JP' },
  { code: 'ko',    name: 'Korean',             nativeName: '한국어',            flag: '🇰🇷', promptName: 'Korean',       ttsLocale: 'ko-KR' },
  { code: 'th',    name: 'Thai',               nativeName: 'ภาษาไทย',          flag: '🇹🇭', promptName: 'Thai',         ttsLocale: 'th-TH' },
  { code: 'id',    name: 'Indonesian',         nativeName: 'Bahasa Indonesia',  flag: '🇮🇩', promptName: 'Indonesian',   ttsLocale: 'id-ID' },
  { code: 'fr',    name: 'French',             nativeName: 'Français',          flag: '🇫🇷', promptName: 'French',       ttsLocale: 'fr-FR' },
  { code: 'de',    name: 'German',             nativeName: 'Deutsch',           flag: '🇩🇪', promptName: 'German',       ttsLocale: 'de-DE' },
  { code: 'es',    name: 'Spanish',            nativeName: 'Español',           flag: '🇪🇸', promptName: 'Spanish',      ttsLocale: 'es-ES' },
  { code: 'pt',    name: 'Portuguese',         nativeName: 'Português',         flag: '🇵🇹', promptName: 'Portuguese',   ttsLocale: 'pt-BR' },
  { code: 'it',    name: 'Italian',            nativeName: 'Italiano',          flag: '🇮🇹', promptName: 'Italian',      ttsLocale: 'it-IT' },
  { code: 'ru',    name: 'Russian',            nativeName: 'Русский',           flag: '🇷🇺', promptName: 'Russian',      ttsLocale: 'ru-RU' },
  { code: 'ar',    name: 'Arabic',             nativeName: 'العربية',           flag: '🇸🇦', promptName: 'Arabic',       ttsLocale: 'ar-SA' },
  { code: 'hi',    name: 'Hindi',              nativeName: 'हिन्दी',           flag: '🇮🇳', promptName: 'Hindi',        ttsLocale: 'hi-IN' },
  { code: 'bn',    name: 'Bengali',            nativeName: 'বাংলা',            flag: '🇧🇩', promptName: 'Bengali',      ttsLocale: null },
  { code: 'nl',    name: 'Dutch',              nativeName: 'Nederlands',        flag: '🇳🇱', promptName: 'Dutch',        ttsLocale: 'nl-NL' },
  { code: 'pl',    name: 'Polish',             nativeName: 'Polski',            flag: '🇵🇱', promptName: 'Polish',       ttsLocale: 'pl-PL' },
  { code: 'tr',    name: 'Turkish',            nativeName: 'Türkçe',            flag: '🇹🇷', promptName: 'Turkish',      ttsLocale: 'tr-TR' },
  { code: 'el',    name: 'Greek',              nativeName: 'Ελληνικά',         flag: '🇬🇷', promptName: 'Greek',        ttsLocale: 'el-GR' },
  { code: 'he',    name: 'Hebrew',             nativeName: 'עברית',            flag: '🇮🇱', promptName: 'Hebrew',       ttsLocale: 'he-IL' },
  { code: 'uk',    name: 'Ukrainian',          nativeName: 'Українська',        flag: '🇺🇦', promptName: 'Ukrainian',    ttsLocale: 'uk-UA' },
  { code: 'sv',    name: 'Swedish',            nativeName: 'Svenska',           flag: '🇸🇪', promptName: 'Swedish',      ttsLocale: 'sv-SE' },
  { code: 'fil',   name: 'Filipino',           nativeName: 'Filipino',          flag: '🇵🇭', promptName: 'Filipino',     ttsLocale: 'fil-PH' },
  { code: 'my',    name: 'Burmese',            nativeName: 'မြန်မာဘာသာ',       flag: '🇲🇲', promptName: 'Burmese',      ttsLocale: null },
  { code: 'km',    name: 'Khmer',              nativeName: 'ភាសាខ្មែរ',         flag: '🇰🇭', promptName: 'Khmer',        ttsLocale: null },
  { code: 'lo',    name: 'Lao',                nativeName: 'ພາສາລາວ',           flag: '🇱🇦', promptName: 'Lao',          ttsLocale: null },
  { code: 'ne',    name: 'Nepali',             nativeName: 'नेपाली',            flag: '🇳🇵', promptName: 'Nepali',       ttsLocale: null },
  { code: 'si',    name: 'Sinhala',            nativeName: 'සිංහල',             flag: '🇱🇰', promptName: 'Sinhala',      ttsLocale: null },
  { code: 'ur',    name: 'Urdu',               nativeName: 'اردو',              flag: '🇵🇰', promptName: 'Urdu',         ttsLocale: 'ur-PK' },
  { code: 'ms',    name: 'Malay',              nativeName: 'Bahasa Melayu',     flag: '🇲🇾', promptName: 'Malay',        ttsLocale: 'ms-MY' },
  { code: 'zh-tw', name: 'Traditional Chinese', nativeName: '繁體中文',         flag: '🇹🇼', promptName: '繁體中文',     ttsLocale: 'zh-TW', isChinese: true },
  { code: 'yue',   name: 'Cantonese',          nativeName: '粵語',              flag: '🇭🇰', promptName: '粵語',         ttsLocale: 'zh-HK', isChinese: true },
];

export const getLanguageByCode = (code: string): Language | undefined =>
  LANGUAGES.find((l) => l.code === code);

export const DEFAULT_SOURCE = 'en';
export const DEFAULT_TARGET = 'vi';
