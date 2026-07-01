# ML Kit translation (`feat/mlkit-translate`)

The 1.14 GB Qwen3 GGUF (llama) engine has been **removed**. The app now runs entirely on
**Google ML Kit on-device translation**, which downloads only the language packs the user
needs (~30 MB each) and runs fully offline after a one-time per-language download. This
kills the ~71% drop-off at the old giant-model download step.

Trade-off vs llama: more literal (NMT, not an LLM), and 6 languages have no ML Kit model.

## Languages

- **66 languages** exposed in the picker (33 original + 33 newly enabled by ML Kit).
- **60 translate via ML Kit.** Traditional Chinese is approximated to (Simplified) Chinese.
- **6 unsupported** (Burmese, Khmer, Lao, Nepali, Sinhala, Cantonese) stay in the picker
  but render dimmed with a "Soon" badge; tapping shows a "Not supported yet" alert instead
  of selecting. Support set lives in [`src/constants/mlkitLanguages.ts`](../src/constants/mlkitLanguages.ts).

## Voice (Whisper) is unchanged

Speech-to-text still uses its own Whisper pack, managed in Settings, independent of the
translation engine.

## What changed

| File | Change |
|---|---|
| `package.json` | + `fast-mlkit-translate-text` (New-Arch/TurboModule ML Kit with real iOS support) |
| `src/config/translationEngine.ts` | engine flag (new) |
| `src/constants/mlkitLanguages.ts` | our code → ML Kit `TranslateLanguage` map + support checks (new) |
| `src/utils/mlkitTranslate.ts` | `mlkitTranslate()` + `ensureMlkitModels()` warm-up (new) |
| `src/hooks/useMlkitTranslate.ts` | ML Kit hook shaped like the `{ translate, isReady }` slice of `useLlama` (new) |
| `src/hooks/useTranslator.ts` | picks engine from the flag (new) |
| `app/index.tsx`, `app/image-translate.tsx` | `useLlama()` → `useTranslator()`; block/image batch translates each block individually under ML Kit (the llama numbered-prompt batch is LLM-only) |

`settings.tsx` still uses `useLlama` directly for the llama pack UI — untouched, harmless
in ML Kit mode (that pack simply never gets downloaded).

## How to build & test (native rebuild required)

This adds native code, so Expo Go / a plain JS reload won't pick it up — you need a fresh
dev-client build.

```bash
npm install
npx expo prebuild            # regenerate ios/ android/ with the new native module
cd ios && pod install && cd ..
npx expo run:ios             # or: npx expo run:android
```

Then in the app: pick a supported language pair → Translate. First translation for a new
language blocks briefly while ML Kit fetches the ~30 MB pack, then it's instant & offline.
Watch device storage / network to confirm the small per-language downloads.

## Known limitations (important for the go/no-go call)

1. **6 languages have no ML Kit model** — Burmese, Khmer, Lao, Nepali, Sinhala, Cantonese.
   `mlkitTranslate()` throws `MlkitUnsupportedLanguageError` for these. Cantonese and
   Traditional Chinese (`zh-tw`) currently fall back to Simplified Chinese. The UI does
   **not** yet gray these out — wire that up before shipping.
2. **Auto-detect source.** `translate()` needs an explicit source; our pipelines pass
   `'auto'`, so `mlkitTranslate()` runs ML Kit's `identify()` to detect it and falls back
   to the user's selected source (`store.sourceLang`) when detection is inconclusive.
3. **More literal output.** ML Kit is NMT, not an LLM — it won't preserve tone, slang, or
   profanity the way the current `SYSTEM_PROMPT` asks llama to. This is the main quality
   trade-off to judge.
4. **Model management available.** `fast-mlkit-translate-text` exposes
   `downloadLanguageModel` / `deleteLanguageModel` / `getDownloadedLanguageModels` /
   `isLanguageDownloaded`, so a real per-language management screen in Settings is
   feasible (not wired up yet).
5. **No streaming.** `translate()` resolves the whole string at once; the streaming
   token UI only applies to llama.
6. `translate()` also accepts `requireWifi` / `requireCharging` — worth using to avoid
   pulling packs on cellular.

## If we keep it — follow-ups

- Gray out / hide the 6 unsupported languages (and mark Cantonese/Traditional as
  Simplified fallback) in the language picker.
- Pre-warm packs on language change via `ensureMlkitModels()` so the first translation
  isn't blocked.
- Decide the story for llama: drop it entirely (smallest app, loses conversational
  quality + 6 languages), or keep it as an optional "high quality / more languages"
  engine the user can switch to.
