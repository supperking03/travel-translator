import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Image, StyleSheet, Dimensions, ActivityIndicator,
  Text, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Rect, Text as SvgText, G } from 'react-native-svg';
import { ReactNativeZoomableView } from '@openspacelabs/react-native-zoomable-view';

import { DS, useDSColors, useDSIsDark } from '@/constants/designSystem';
import { useStore } from '@/store/useStore';
import { useLlama } from '@/hooks/useLlama';
import { recognizeTextBlocksFromImage, TextBlock } from '@/utils/imageTextRecognition';
import { getLanguageByCode } from '@/constants/languages';

const { width: SW, height: SH } = Dimensions.get('window');

type TranslatedBlock = TextBlock & { translated: string };
type Phase = 'ocr' | 'translating' | 'done' | 'error';

// ─── Batch translate all blocks in one model call ─────────────────────────────
async function batchTranslate(
  blocks: TextBlock[],
  targetLangCode: string,
  translate: (text: string, sourceLang: string, targetLang: string) => Promise<string>
): Promise<string[]> {
  if (blocks.length === 0) return [];

  const targetName = getLanguageByCode(targetLangCode)?.name ?? targetLangCode;
  const numbered   = blocks.map((b, i) => `${i + 1}. ${b.text}`).join('\n');
  const prompt     = `Translate each numbered item to ${targetName}. Reply only with the numbered translations, same format:\n${numbered}`;

  const raw = await translate(prompt, 'auto', targetLangCode);

  const result = new Array<string>(blocks.length).fill('');
  for (const line of raw.split('\n')) {
    const m = line.match(/^(\d+)[.)]\s*(.+)$/);
    if (m) {
      const idx = parseInt(m[1], 10) - 1;
      if (idx >= 0 && idx < blocks.length) result[idx] = m[2].trim();
    }
  }
  return result;
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function ImageTranslateScreen() {
  const C      = useDSColors();
  const isDark = useDSIsDark();
  const nav    = useNavigation();
  const router = useRouter();
  const { imageUri } = useLocalSearchParams<{ imageUri: string }>();

  const { sourceLang, targetLang, setSourceText, setTranslatedText } = useStore();
  const { translate, isReady } = useLlama();

  const [phase, setPhase]   = useState<Phase>('ocr');
  const [error, setError]   = useState('');
  const [blocks, setBlocks] = useState<TranslatedBlock[]>([]);
  const [dispW, setDispW]   = useState(SW);
  const [dispH, setDispH]   = useState(SW);
  const cancelled           = useRef(false);

  useEffect(() => {
    nav.setOptions({ title: 'Image Translation' });
    return () => { cancelled.current = true; };
  }, [nav]);

  useEffect(() => {
    if (!imageUri) return;
    run(decodeURIComponent(imageUri));
  }, [imageUri]);

  const run = useCallback(async (uri: string) => {
    try {
      // Size → compute display dimensions preserving aspect ratio
      await new Promise<void>((res) =>
        Image.getSize(uri, (w, h) => {
          const scale = Math.min(SW / w, (SH * 0.75) / h);
          setDispW(w * scale);
          setDispH(h * scale);
          res();
        }, () => res())
      );

      if (cancelled.current) return;

      // Step 1 — OCR with boxes
      setPhase('ocr');
      const rawBlocks = await recognizeTextBlocksFromImage(uri, sourceLang);
      if (cancelled.current) return;

      if (rawBlocks.length === 0) {
        setPhase('done');
        return;
      }

      // Step 2 — Batch translate
      if (!isReady) {
        router.replace('/settings?focus=download');
        return;
      }

      setPhase('translating');
      const translations = await batchTranslate(rawBlocks, targetLang, translate);
      if (cancelled.current) return;

      setBlocks(rawBlocks.map((b, i) => ({
        ...b,
        translated: translations[i] || b.text,
      })));
      setPhase('done');
    } catch (err) {
      if (!cancelled.current) {
        setError(err instanceof Error ? err.message : 'Something went wrong');
        setPhase('error');
      }
    }
  }, [sourceLang, targetLang, translate, isReady, router]);

  // ── Use extracted text in main translator ─────────────────────────────────
  const handleUseText = useCallback(() => {
    const combined = blocks.map(b => b.text).join('\n');
    const translated = blocks.map(b => b.translated).join('\n');
    setSourceText(combined);
    setTranslatedText(translated);
    router.back();
  }, [blocks, setSourceText, setTranslatedText, router]);

  const uri = decodeURIComponent(imageUri ?? '');

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: C.background }]} edges={['bottom']}>

      {/* ── Loading ─────────────────────────────────────────────────────────── */}
      {phase !== 'done' && phase !== 'error' && (
        <View style={s.loadingWrap}>
          <ActivityIndicator size="large" color={C.primary} />
          <Text style={[s.loadingTitle, { color: C.textPrimary }]}>
            {phase === 'ocr' ? 'Reading text…' : 'Translating…'}
          </Text>
          <Text style={[s.loadingSub, { color: C.textMuted }]}>
            {phase === 'ocr'
              ? 'Apple Vision is detecting text'
              : 'AI model is translating all blocks'}
          </Text>
        </View>
      )}

      {/* ── Error ───────────────────────────────────────────────────────────── */}
      {phase === 'error' && (
        <View style={s.loadingWrap}>
          <Ionicons name="alert-circle-outline" size={48} color={C.danger} />
          <Text style={[s.loadingTitle, { color: C.textPrimary }]}>Failed</Text>
          <Text style={[s.loadingSub, { color: C.textMuted }]}>{error}</Text>
        </View>
      )}

      {/* ── Image + overlay ─────────────────────────────────────────────────── */}
      {phase === 'done' && (
        <>
          <ReactNativeZoomableView
            maxZoom={5}
            minZoom={0.8}
            zoomStep={0.5}
            initialZoom={1}
            style={s.zoomable}
            contentWidth={dispW}
            contentHeight={dispH}
          >
            <View style={{ width: dispW, height: dispH }}>
              <Image
                source={{ uri }}
                style={{ width: dispW, height: dispH }}
                resizeMode="contain"
              />

              {blocks.length > 0 && (
                <Svg style={StyleSheet.absoluteFill} width={dispW} height={dispH}>
                  {blocks.map((block, i) => {
                    const bx = block.x * dispW;
                    const by = block.y * dispH;
                    const bw = block.width  * dispW;
                    const bh = block.height * dispH;
                    const fs = Math.max(8, Math.min(bh * 0.68, 15));

                    return (
                      <G key={i}>
                        <Rect
                          x={bx} y={by} width={bw} height={bh}
                          fill="white" opacity={0.9} rx={3}
                        />
                        <SvgText
                          x={bx + 3}
                          y={by + bh * 0.75}
                          fontSize={fs}
                          fill="#0F172A"
                          fontWeight="bold"
                        >
                          {block.translated}
                        </SvgText>
                      </G>
                    );
                  })}
                </Svg>
              )}
            </View>
          </ReactNativeZoomableView>

          {/* ── No text found ──────────────────────────────────────────────── */}
          {blocks.length === 0 && (
            <View style={[s.noTextBanner, { backgroundColor: C.warningSoft }]}>
              <Ionicons name="scan-outline" size={18} color={C.warning} />
              <Text style={[s.noTextLabel, { color: C.warning }]}>No text detected in this image</Text>
            </View>
          )}

          {/* ── Footer action ──────────────────────────────────────────────── */}
          {blocks.length > 0 && (
            <View style={[s.footer, { backgroundColor: C.background, borderTopColor: C.border }]}>
              <TouchableOpacity
                style={[s.footerBtn, { backgroundColor: C.surface, borderColor: C.border }]}
                onPress={handleUseText}
                activeOpacity={0.75}
              >
                <Ionicons name="create-outline" size={DS.icon.sm} color={C.primary} />
                <Text style={[s.footerBtnLabel, { color: C.primary }]}>Use in translator</Text>
              </TouchableOpacity>
            </View>
          )}
        </>
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:        { flex: 1 },
  zoomable:    { flex: 1, alignItems: 'center', justifyContent: 'center' },

  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: DS.space.sm,
    paddingHorizontal: DS.space.xl,
  },
  loadingTitle: { ...DS.type.callout, fontWeight: '600', marginTop: DS.space.sm },
  loadingSub:   { ...DS.type.footnote, textAlign: 'center' },

  noTextBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DS.space.sm,
    margin: DS.space.md,
    padding: DS.space.md,
    borderRadius: DS.radius.lg,
  },
  noTextLabel: { ...DS.type.subhead, fontWeight: '600' },

  footer: {
    paddingHorizontal: DS.space.md,
    paddingVertical: DS.space.sm + DS.space.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: DS.space.sm,
    height: DS.control.ctaHeight - 8,
    borderRadius: DS.radius.lg,
    borderWidth: 1,
  },
  footerBtnLabel: { ...DS.type.subhead, fontWeight: '700' },
});
