// Which translation backend the app uses.
//
// The app runs on 'mlkit' — Google ML Kit on-device NMT, downloading only the per-language
// packs the user needs (~30 MB each). 60 of the 66 languages in the picker translate; the
// 6 in MLKIT_UNSUPPORTED_CODES show a "Soon" badge.
//
// The legacy 'llama' engine (1.14 GB Qwen3 GGUF) has been removed; the type value is kept
// only so the block-batch code can branch on the engine.
export type TranslationEngine = 'llama' | 'mlkit';

export const TRANSLATION_ENGINE: TranslationEngine = 'mlkit';
