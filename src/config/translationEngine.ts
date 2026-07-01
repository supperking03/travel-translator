// Which translation backend the app uses.
//
//   'llama' — the shipping engine: one 1.14 GB Qwen3-1.7B GGUF pack, offline LLM,
//             preserves tone/slang, supports all 33 languages incl. Burmese/Khmer/
//             Lao/Nepali/Sinhala/Cantonese.
//   'mlkit' — experimental: Google ML Kit on-device NMT. Downloads only the language
//             packs the user needs (~30 MB each) instead of one huge file. More literal
//             translations, and 6 languages are unsupported (see mlkitLanguages.ts).
//
// This whole branch (feat/mlkit-translate) exists to A/B this switch. Flip the constant
// and rebuild to compare download friction, quality, and speed against llama.
export type TranslationEngine = 'llama' | 'mlkit';

export const TRANSLATION_ENGINE: TranslationEngine = 'mlkit';
