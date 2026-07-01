import type { Languages } from 'fast-mlkit-translate-text';

// Maps our internal language codes (see constants/languages.ts) to the language *names*
// that fast-mlkit-translate-text expects (its `Languages` union).
//
// ML Kit covers ~59 languages but NOT all of ours. Six travel languages have no ML Kit
// model at all, and Cantonese/Traditional Chinese collapse to Chinese. Anything not in
// this map is unsupported → mlkitTranslate() throws and the UI should surface
// "not available offline via ML Kit".
//
//   Unsupported by ML Kit: my (Burmese), km (Khmer), lo (Lao), ne (Nepali),
//                          si (Sinhala), yue (Cantonese)
//   Approximated:          zh-tw (Traditional) → Chinese output
const CODE_TO_MLKIT: Record<string, Languages | undefined> = {
  en: 'English',
  zh: 'Chinese',
  vi: 'Vietnamese',
  ja: 'Japanese',
  ko: 'Korean',
  th: 'Thai',
  id: 'Indonesian',
  fr: 'French',
  de: 'German',
  es: 'Spanish',
  pt: 'Portuguese',
  it: 'Italian',
  ru: 'Russian',
  ar: 'Arabic',
  hi: 'Hindi',
  bn: 'Bengali',
  nl: 'Dutch',
  pl: 'Polish',
  tr: 'Turkish',
  el: 'Greek',
  he: 'Hebrew',
  uk: 'Ukrainian',
  sv: 'Swedish',
  fil: 'Tagalog', // ML Kit calls Filipino "Tagalog"
  ur: 'Urdu',
  ms: 'Malay',

  // Approximated — ML Kit has only generic (Simplified) Chinese.
  'zh-tw': 'Chinese',

  // Additional languages ML Kit supports (offline NMT).
  fa: 'Persian',
  ro: 'Romanian',
  cs: 'Czech',
  hu: 'Hungarian',
  da: 'Danish',
  fi: 'Finnish',
  no: 'Norwegian',
  sk: 'Slovak',
  hr: 'Croatian',
  bg: 'Bulgarian',
  sl: 'Slovenian',
  et: 'Estonian',
  lv: 'Latvian',
  lt: 'Lithuanian',
  sq: 'Albanian',
  mk: 'Macedonian',
  be: 'Belarusian',
  is: 'Icelandic',
  ga: 'Irish',
  cy: 'Welsh',
  mt: 'Maltese',
  ca: 'Catalan',
  gl: 'Galician',
  af: 'Afrikaans',
  sw: 'Swahili',
  ta: 'Tamil',
  te: 'Telugu',
  kn: 'Kannada',
  gu: 'Gujarati',
  mr: 'Marathi',
  ka: 'Georgian',
  ht: 'Haitian',
  eo: 'Esperanto',
};

/** ML Kit language name for one of our codes, or null if ML Kit can't handle it. */
export function toMlkitLanguage(code: string): Languages | null {
  return CODE_TO_MLKIT[code] ?? null;
}

export function isMlkitSupported(code: string): boolean {
  return CODE_TO_MLKIT[code] != null;
}

/** Our codes that ML Kit cannot translate — used to warn the user / gate the UI. */
export const MLKIT_UNSUPPORTED_CODES = [
  'my',  // Burmese
  'km',  // Khmer
  'lo',  // Lao
  'ne',  // Nepali
  'si',  // Sinhala
  'yue', // Cantonese
] as const;
