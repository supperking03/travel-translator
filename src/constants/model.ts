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
  n_ctx: 2048,
  n_threads: 4,
  n_batch: 64,
};

// Qwen3 thinking mode disabled (/no_think) for fast translation output
export const TRANSLATION_COMPLETION_PARAMS = {
  n_predict: 512,
  temperature: 0.7,
  top_p: 0.8,
  top_k: 20,
  repeat_penalty: 1.05,
};

// Qwen3 system prompt: translator role, no thinking mode
export const SYSTEM_PROMPT =
  'You are a professional travel translator. Translate exactly what the user writes. Output only the translation, no explanations.';

// Prompt format for Qwen3
// Append /no_think to disable chain-of-thought for faster responses
export const buildTranslationPrompt = (
  text: string,
  targetLanguageName: string,
  sourceIsChineseFamily: boolean
): string => {
  if (sourceIsChineseFamily) {
    return `将以下文本翻译为${targetLanguageName}，只输出翻译结果：\n\n${text.trim()} /no_think`;
  }
  return `Translate to ${targetLanguageName}:\n\n${text.trim()} /no_think`;
};
