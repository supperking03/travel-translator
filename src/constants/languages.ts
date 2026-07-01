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

  // ── Additional languages enabled by the ML Kit engine (offline NMT) ──────────
  // promptName is legacy (unused since llama was removed); kept to satisfy the type.
  { code: 'fa',    name: 'Persian',            nativeName: 'فارسی',             flag: '🇮🇷', promptName: 'Persian',      ttsLocale: null },
  { code: 'ro',    name: 'Romanian',           nativeName: 'Română',            flag: '🇷🇴', promptName: 'Romanian',     ttsLocale: 'ro-RO' },
  { code: 'cs',    name: 'Czech',              nativeName: 'Čeština',           flag: '🇨🇿', promptName: 'Czech',        ttsLocale: 'cs-CZ' },
  { code: 'hu',    name: 'Hungarian',          nativeName: 'Magyar',            flag: '🇭🇺', promptName: 'Hungarian',    ttsLocale: 'hu-HU' },
  { code: 'da',    name: 'Danish',             nativeName: 'Dansk',             flag: '🇩🇰', promptName: 'Danish',       ttsLocale: 'da-DK' },
  { code: 'fi',    name: 'Finnish',            nativeName: 'Suomi',             flag: '🇫🇮', promptName: 'Finnish',      ttsLocale: 'fi-FI' },
  { code: 'no',    name: 'Norwegian',          nativeName: 'Norsk',             flag: '🇳🇴', promptName: 'Norwegian',    ttsLocale: 'no-NO' },
  { code: 'sk',    name: 'Slovak',             nativeName: 'Slovenčina',        flag: '🇸🇰', promptName: 'Slovak',       ttsLocale: 'sk-SK' },
  { code: 'hr',    name: 'Croatian',           nativeName: 'Hrvatski',          flag: '🇭🇷', promptName: 'Croatian',     ttsLocale: null },
  { code: 'bg',    name: 'Bulgarian',          nativeName: 'Български',          flag: '🇧🇬', promptName: 'Bulgarian',    ttsLocale: null },
  { code: 'sl',    name: 'Slovenian',          nativeName: 'Slovenščina',       flag: '🇸🇮', promptName: 'Slovenian',    ttsLocale: null },
  { code: 'et',    name: 'Estonian',           nativeName: 'Eesti',             flag: '🇪🇪', promptName: 'Estonian',     ttsLocale: null },
  { code: 'lv',    name: 'Latvian',            nativeName: 'Latviešu',          flag: '🇱🇻', promptName: 'Latvian',      ttsLocale: null },
  { code: 'lt',    name: 'Lithuanian',         nativeName: 'Lietuvių',          flag: '🇱🇹', promptName: 'Lithuanian',   ttsLocale: null },
  { code: 'sq',    name: 'Albanian',           nativeName: 'Shqip',             flag: '🇦🇱', promptName: 'Albanian',     ttsLocale: null },
  { code: 'mk',    name: 'Macedonian',         nativeName: 'Македонски',        flag: '🇲🇰', promptName: 'Macedonian',   ttsLocale: null },
  { code: 'be',    name: 'Belarusian',         nativeName: 'Беларуская',        flag: '🇧🇾', promptName: 'Belarusian',   ttsLocale: null },
  { code: 'is',    name: 'Icelandic',          nativeName: 'Íslenska',          flag: '🇮🇸', promptName: 'Icelandic',    ttsLocale: null },
  { code: 'ga',    name: 'Irish',              nativeName: 'Gaeilge',           flag: '🇮🇪', promptName: 'Irish',        ttsLocale: null },
  { code: 'cy',    name: 'Welsh',              nativeName: 'Cymraeg',           flag: '🏴󠁧󠁢󠁷󠁬󠁳󠁿', promptName: 'Welsh',        ttsLocale: null },
  { code: 'mt',    name: 'Maltese',            nativeName: 'Malti',             flag: '🇲🇹', promptName: 'Maltese',      ttsLocale: null },
  { code: 'ca',    name: 'Catalan',            nativeName: 'Català',            flag: '🇪🇸', promptName: 'Catalan',      ttsLocale: null },
  { code: 'gl',    name: 'Galician',           nativeName: 'Galego',            flag: '🇪🇸', promptName: 'Galician',     ttsLocale: null },
  { code: 'af',    name: 'Afrikaans',          nativeName: 'Afrikaans',         flag: '🇿🇦', promptName: 'Afrikaans',    ttsLocale: null },
  { code: 'sw',    name: 'Swahili',            nativeName: 'Kiswahili',         flag: '🇹🇿', promptName: 'Swahili',      ttsLocale: null },
  { code: 'ta',    name: 'Tamil',              nativeName: 'தமிழ்',             flag: '🇮🇳', promptName: 'Tamil',        ttsLocale: null },
  { code: 'te',    name: 'Telugu',             nativeName: 'తెలుగు',            flag: '🇮🇳', promptName: 'Telugu',       ttsLocale: null },
  { code: 'kn',    name: 'Kannada',            nativeName: 'ಕನ್ನಡ',             flag: '🇮🇳', promptName: 'Kannada',      ttsLocale: null },
  { code: 'gu',    name: 'Gujarati',           nativeName: 'ગુજરાતી',           flag: '🇮🇳', promptName: 'Gujarati',     ttsLocale: null },
  { code: 'mr',    name: 'Marathi',            nativeName: 'मराठी',             flag: '🇮🇳', promptName: 'Marathi',      ttsLocale: null },
  { code: 'ka',    name: 'Georgian',           nativeName: 'ქართული',          flag: '🇬🇪', promptName: 'Georgian',     ttsLocale: null },
  { code: 'ht',    name: 'Haitian Creole',     nativeName: 'Kreyòl Ayisyen',    flag: '🇭🇹', promptName: 'Haitian',      ttsLocale: null },
  { code: 'eo',    name: 'Esperanto',          nativeName: 'Esperanto',         flag: '🌐', promptName: 'Esperanto',    ttsLocale: null },
];

export const getLanguageByCode = (code: string): Language | undefined =>
  LANGUAGES.find((l) => l.code === code);

export const DEFAULT_SOURCE = 'en';
export const DEFAULT_TARGET = 'vi';
