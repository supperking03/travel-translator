import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
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

  // ML Kit per-language pack download (transient, not persisted)
  mlkitPackStatus: 'idle' | 'downloading' | 'error';
  mlkitPackLabel: string;
  setMlkitPack: (status: 'idle' | 'downloading' | 'error', label?: string) => void;

  // Voice recognition model state (Whisper)
  whisperModelStatus: ModelStatus;
  whisperDownloadProgress: number;
  whisperModelError: string | null;
  setWhisperModelStatus: (status: ModelStatus) => void;
  setWhisperDownloadProgress: (progress: number) => void;
  setWhisperModelError: (error: string | null) => void;

  // History
  history: HistoryEntry[];
  addHistory: (entry: Omit<HistoryEntry, 'id' | 'timestamp'>) => void;
  clearHistory: () => void;

  // App Store review prompt (happy-path gating)
  successfulTranslations: number;
  reviewPromptCount: number;
  bumpSuccessfulTranslations: () => number;
  incrementReviewPromptCount: () => void;

  // In-app (local) review modal
  reviewPromptVisible: boolean;               // transient — controls the modal
  setReviewPromptVisible: (v: boolean) => void;
  localReviewSubmitted: boolean;              // persisted — don't nag once they've reviewed
  setLocalReviewSubmitted: (v: boolean) => void;

  // Onboarding
  onboardingComplete: boolean;
  setOnboardingComplete: (v: boolean) => void;

  // App language (i18n)
  appLanguage: string;
  setAppLanguage: (lang: string) => void;

  // Appearance
  themePreference: 'system' | 'light' | 'dark';
  setThemePreference: (pref: 'system' | 'light' | 'dark') => void;
}

export const useStore = create<TranslatorState>()(
  persist(
    (set, get) => ({
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

      mlkitPackStatus: 'idle',
      mlkitPackLabel: '',
      setMlkitPack: (status, label = '') => set({ mlkitPackStatus: status, mlkitPackLabel: label }),

      whisperModelStatus: 'not_downloaded',
      whisperDownloadProgress: 0,
      whisperModelError: null,
      setWhisperModelStatus: (status) => set({ whisperModelStatus: status }),
      setWhisperDownloadProgress: (progress) => set({ whisperDownloadProgress: progress }),
      setWhisperModelError: (error) => set({ whisperModelError: error }),

      history: [],
      addHistory: (entry) =>
        set((state) => ({
          history: [
            { ...entry, id: Date.now().toString(), timestamp: Date.now() },
            ...state.history.slice(0, 49),
          ],
        })),
      clearHistory: () => set({ history: [] }),

      successfulTranslations: 0,
      reviewPromptCount: 0,
      bumpSuccessfulTranslations: () => {
        const next = get().successfulTranslations + 1;
        set({ successfulTranslations: next });
        return next;
      },
      incrementReviewPromptCount: () =>
        set((state) => ({ reviewPromptCount: state.reviewPromptCount + 1 })),

      reviewPromptVisible: false,
      setReviewPromptVisible: (v) => set({ reviewPromptVisible: v }),
      localReviewSubmitted: false,
      setLocalReviewSubmitted: (v) => set({ localReviewSubmitted: v }),

      onboardingComplete: false,
      setOnboardingComplete: (v) => set({ onboardingComplete: v }),

      appLanguage: 'en',
      setAppLanguage: (lang) => set({ appLanguage: lang }),

      themePreference: 'system',
      setThemePreference: (pref) => set({ themePreference: pref }),
    }),
    {
      name: 'travel-translator-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        onboardingComplete: state.onboardingComplete,
        appLanguage:        state.appLanguage,
        themePreference:    state.themePreference,
        sourceLang:         state.sourceLang,
        targetLang:         state.targetLang,
        history:            state.history,
        successfulTranslations: state.successfulTranslations,
        reviewPromptCount:      state.reviewPromptCount,
        localReviewSubmitted:   state.localReviewSubmitted,
      }),
    }
  )
);
