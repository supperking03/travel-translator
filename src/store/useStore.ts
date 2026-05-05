import { create } from 'zustand';
import { DEFAULT_SOURCE, DEFAULT_TARGET } from '@/constants/languages';

export type ModelStatus = 'not_downloaded' | 'downloading' | 'loading' | 'ready' | 'error';

export interface HistoryEntry {
  id: string;
  sourceText: string;
  translatedText: string;
  sourceLang: string;
  targetLang: string;
  timestamp: number;
}

interface TranslatorState {
  // Language selection
  sourceLang: string;
  targetLang: string;
  setSourceLang: (lang: string) => void;
  setTargetLang: (lang: string) => void;
  swapLanguages: () => void;

  // Translation text
  sourceText: string;
  translatedText: string;
  setSourceText: (text: string) => void;
  setTranslatedText: (text: string) => void;

  // Translation state
  isTranslating: boolean;
  setIsTranslating: (v: boolean) => void;

  // Model state
  modelStatus: ModelStatus;
  downloadProgress: number;
  modelError: string | null;
  setModelStatus: (status: ModelStatus) => void;
  setDownloadProgress: (progress: number) => void;
  setModelError: (error: string | null) => void;

  // History
  history: HistoryEntry[];
  addHistory: (entry: Omit<HistoryEntry, 'id' | 'timestamp'>) => void;
  clearHistory: () => void;
}

export const useStore = create<TranslatorState>((set, get) => ({
  sourceLang: DEFAULT_SOURCE,
  targetLang: DEFAULT_TARGET,
  setSourceLang: (lang) => set({ sourceLang: lang }),
  setTargetLang: (lang) => set({ targetLang: lang }),
  swapLanguages: () => {
    const { sourceLang, targetLang, sourceText, translatedText } = get();
    set({
      sourceLang: targetLang,
      targetLang: sourceLang,
      sourceText: translatedText,
      translatedText: sourceText,
    });
  },

  sourceText: '',
  translatedText: '',
  setSourceText: (text) => set({ sourceText: text, translatedText: '' }),
  setTranslatedText: (text) => set({ translatedText: text }),

  isTranslating: false,
  setIsTranslating: (v) => set({ isTranslating: v }),

  modelStatus: 'not_downloaded',
  downloadProgress: 0,
  modelError: null,
  setModelStatus: (status) => set({ modelStatus: status }),
  setDownloadProgress: (progress) => set({ downloadProgress: progress }),
  setModelError: (error) => set({ modelError: error }),

  history: [],
  addHistory: (entry) =>
    set((state) => ({
      history: [
        {
          ...entry,
          id: Date.now().toString(),
          timestamp: Date.now(),
        },
        ...state.history.slice(0, 49), // keep last 50
      ],
    })),
  clearHistory: () => set({ history: [] }),
}));
