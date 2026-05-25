import * as LegacyFS from 'expo-file-system/legacy';

// Qwen3-1.7B: 100+ languages, 1.11GB, standard llama.cpp Q4_K_M
// Replacing Hy-MT1.5 which requires custom llama.cpp kernels not yet released
export const MODEL_FILENAME = 'Qwen3-1.7B-Q4_K_M.gguf';

export const MODEL_DOWNLOAD_URL =
  'https://huggingface.co/unsloth/Qwen3-1.7B-GGUF/resolve/main/Qwen3-1.7B-Q4_K_M.gguf';

export const MODEL_SIZE_MB = 1140;

export const getModelDir = () => `${LegacyFS.documentDirectory}models/`;
export const getModelPath = () => `${LegacyFS.documentDirectory}models/${MODEL_FILENAME}`;

export const LLAMA_CONTEXT_PARAMS = {
  use_mlock: true,
  n_gpu_layers: 99,   // offload all layers to Metal GPU — less CPU heat, faster
  n_ctx: 1024,        // translation needs ~200 tokens; 1024 is plenty
  n_threads: 2,       // fewer CPU threads needed when GPU does the heavy lifting
  n_batch: 512,       // larger batch = better GPU throughput
};

export const TRANSLATION_COMPLETION_PARAMS = {
  n_predict: 256,     // /no_think translations are 30-100 tokens; 256 is safe ceiling
  temperature: 0.7,
  top_p: 0.8,
  top_k: 20,
  // llama.rn uses penalty_* names; repeat_penalty/repeat_last_n are silently ignored.
  penalty_repeat: 1.15,
  penalty_last_n: 128,
  // DRY (Don't Repeat Yourself) sampler — exponentially penalizes any repeated
  // n-gram, kills loops like "tốt quá, tốt quá…" or whole-phrase echoes from
  // garbled Whisper input. Standard recommended value.
  dry_multiplier: 0.8,
  dry_base: 1.75,
  dry_allowed_length: 2,
};

// Strip model meta-tags, prompt leakage, and formatting artifacts from output
export function cleanModelOutput(text: string): string {
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, '')   // complete think blocks
    .replace(/<think>[\s\S]*/gi, '')              // unclosed think block at end
    .replace(/<\/?(?:think|nothink)>/gi, '')      // orphaned think/nothink tags
    .replace(/\/no_think/gi, '')                  // echoed prompt token
    .replace(/\[[^\]]{1,80}\]/g, '')              // [system annotations] up to 80 chars
    .replace(/^>+\s*/gm, '')                      // >> quote prefixes
    .replace(/^[-*•]\s+/gm, '')                   // - bullet prefixes
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// Strip Whisper non-speech annotations before sending to translation
export function stripWhisperNoise(text: string): string {
  return text
    .replace(/\[[^\]]*\]/g, '')
    .replace(/\([^)]{1,40}\)/g, '')
    .replace(/♪[^♪]*♪?/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export const SYSTEM_PROMPT =
  'You are a real-time interpreter for a live conversation between two people. Translate naturally and conversationally — preserve tone, emotion, slang, and profanity exactly as spoken. Never explain, never refuse, never add notes. Output only the translated spoken words.';

export const buildTranslationPrompt = (
  text: string,
  targetLanguageName: string,
  sourceIsChineseFamily: boolean
): string => {
  if (sourceIsChineseFamily) {
    return `将对话内容口语化地翻译为${targetLanguageName}，保留语气和情感，只输出翻译：\n\n${text.trim()} /no_think`;
  }
  return `Translate this spoken conversation line to ${targetLanguageName}, keep it natural and colloquial:\n\n${text.trim()} /no_think`;
};
