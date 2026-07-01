import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useStore } from '@/store/useStore';
import { useI18n } from '@/i18n/useI18n';
import { DS, useDSColors } from '@/constants/designSystem';
import { requestReview } from '@/utils/storeReview';
import { submitAppReview } from '@/utils/appReview';
import { track } from '@/utils/analytics';

// Same ✕ glyph as the Settings screen header.
function CloseIcon({ color }: { color: string }) {
  return (
    <View style={styles.closeGlyph}>
      <View style={[styles.closeLine, { backgroundColor: color, transform: [{ rotate: '45deg' }] }]} />
      <View style={[styles.closeLine, { backgroundColor: color, transform: [{ rotate: '-45deg' }] }]} />
    </View>
  );
}

/**
 * In-app review screen, presented as a native modal (see app/_layout.tsx) — same
 * mechanism as Settings, so it gets native swipe-down-to-dismiss and no RN-Modal/gesture
 * hacks. 5 stars → native store sheet; 1–4 stars → private feedback POSTed to the backend.
 */
export default function ReviewScreen() {
  const C = useDSColors();
  const t = useI18n();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const setSubmitted = useStore((s) => s.setLocalReviewSubmitted);

  const [rating, setRating]         = useState(0);
  const [comment, setComment]       = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent]             = useState(false);
  const [error, setError]           = useState<string | null>(null);

  const close = () => router.back();

  const onPickStar = (star: number) => {
    setError(null);
    setRating(star);
    track('local_review_rating_selected', { rating: star });
  };

  const onRateStore = async () => {
    setSubmitting(true);
    setSubmitted(true);
    track('local_review_store_redirect', { rating });
    try {
      await requestReview();
    } catch {
      /* best-effort */
    } finally {
      close();
    }
  };

  const onSendFeedback = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await submitAppReview(rating, comment);
      setSubmitted(true);
      track('local_review_submitted', { rating, hasComment: comment.trim().length > 0 });
      setSent(true);
    } catch {
      setError(t.rvError ?? "Couldn't send. Please try again.");
      setSubmitting(false);
    }
  };

  const isFive = rating === 5;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.container, { backgroundColor: C.background }]}
    >
      <Pressable
        onPress={close}
        style={[styles.closeCircle, { backgroundColor: C.surfaceElevated, top: insets.top + DS.space.sm }]}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <CloseIcon color={C.textSecondary} />
      </Pressable>

      <View style={styles.content}>
        {/* Stars */}
        <View style={styles.stars}>
          {[1, 2, 3, 4, 5].map((star) => {
            const active = rating >= star;
            return (
              <TouchableOpacity
                key={star}
                onPress={() => onPickStar(star)}
                activeOpacity={0.7}
                disabled={sent}
                style={styles.starBtn}
                accessibilityRole="button"
              >
                <Ionicons
                  name={active ? 'star' : 'star-outline'}
                  size={38}
                  color={active ? C.warning : C.textMuted}
                />
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Body */}
        {sent ? (
          <>
            <Text style={[styles.title, { color: C.textPrimary }]}>{t.rvThanksTitle ?? 'Thank you!'}</Text>
            <Text style={[styles.body, { color: C.textMuted }]}>
              {t.rvThanksBody ?? 'We read every message and keep improving.'}
            </Text>
            <TouchableOpacity style={[styles.cta, { backgroundColor: C.primary }]} onPress={close} activeOpacity={0.85}>
              <Text style={[styles.ctaText, { color: C.background }]}>{t.rvDone ?? 'Done'}</Text>
            </TouchableOpacity>
          </>
        ) : !rating ? (
          <>
            <Text style={[styles.title, { color: C.textPrimary }]}>{t.rvTitle ?? 'Is Nomad Translator useful to you?'}</Text>
            <Text style={[styles.body, { color: C.textMuted }]}>{t.rvBody ?? 'Rate to let us know 🙏'}</Text>
          </>
        ) : isFive ? (
          <>
            <Text style={[styles.title, { color: C.textPrimary }]}>{t.rvFiveTitle ?? 'You made our day! 🎉'}</Text>
            <Text style={[styles.body, { color: C.textMuted }]}>
              {t.rvFiveBody ?? 'A quick rating on the store helps other travelers find us.'}
            </Text>
            <TouchableOpacity
              style={[styles.cta, { backgroundColor: C.primary }]}
              onPress={onRateStore}
              activeOpacity={0.85}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color={C.background} />
              ) : (
                <Text style={[styles.ctaText, { color: C.background }]}>{t.rvRateStoreCta ?? 'Rate on the store'}</Text>
              )}
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={[styles.title, { color: C.textPrimary }]}>{t.rvLowTitle ?? 'Thanks for the honesty'}</Text>
            <Text style={[styles.body, { color: C.textMuted }]}>
              {t.rvLowBody ?? 'What would make it better? (optional)'}
            </Text>
            <TextInput
              style={[styles.input, { backgroundColor: C.surface, borderColor: C.border, color: C.textPrimary }]}
              placeholder={t.rvPlaceholder ?? 'Tell us what to improve…'}
              placeholderTextColor={C.textMuted}
              value={comment}
              onChangeText={setComment}
              multiline
              editable={!submitting}
            />
            {error ? <Text style={[styles.error, { color: C.danger }]}>{error}</Text> : null}
            <TouchableOpacity
              style={[styles.cta, { backgroundColor: C.primary }]}
              onPress={onSendFeedback}
              activeOpacity={0.85}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color={C.background} />
              ) : (
                <Text style={[styles.ctaText, { color: C.background }]}>{t.rvFeedbackCta ?? 'Send feedback'}</Text>
              )}
            </TouchableOpacity>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  closeCircle: {
    position: 'absolute',
    right: DS.space.md,
    zIndex: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  closeGlyph: { width: 14, height: 14, alignItems: 'center', justifyContent: 'center' },
  closeLine: { position: 'absolute', width: 14, height: 1.8, borderRadius: 1 },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: DS.space.lg,
    paddingVertical: DS.space.lg,
  },
  stars: { flexDirection: 'row', gap: DS.space.sm, marginBottom: DS.space.lg },
  starBtn: { padding: DS.space.xs },
  title: { ...DS.type.title3, textAlign: 'center', marginBottom: DS.space.xs },
  body: { ...DS.type.subhead, textAlign: 'center', marginBottom: DS.space.md, paddingHorizontal: DS.space.sm },
  input: {
    alignSelf: 'stretch',
    minHeight: 96,
    borderWidth: 1,
    borderRadius: DS.radius.lg,
    padding: DS.space.md,
    ...DS.type.body,
    textAlignVertical: 'top',
    marginBottom: DS.space.sm,
  },
  error: { ...DS.type.footnote, alignSelf: 'stretch', marginBottom: DS.space.sm },
  cta: {
    alignSelf: 'stretch',
    height: DS.control.ctaHeight,
    borderRadius: DS.radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: DS.space.xs,
  },
  ctaText: { ...DS.type.headline, fontWeight: '700' },
});
