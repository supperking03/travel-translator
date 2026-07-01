import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Animated,
  PanResponder,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useStore } from '@/store/useStore';
import { useI18n } from '@/i18n/useI18n';
import { DS, useDSColors, useDSIsDark } from '@/constants/designSystem';
import { requestReview } from '@/utils/storeReview';
import { submitAppReview } from '@/utils/appReview';
import { track } from '@/utils/analytics';

const SCREEN_H = Dimensions.get('window').height;

/**
 * Happy-path in-app review sheet. Opened by reviewPrompt.maybeAskForReview at usage
 * milestones. 5 stars → native store sheet; 1–4 stars → private feedback POSTed to the
 * backend so it never lands on the store. Styled with the app design system.
 *
 * Dismissal is swipe-down only (drag the handle) — tapping the dim backdrop does nothing,
 * so users don't close it by accident before deciding.
 */
export function LocalReviewPrompt() {
  const C      = useDSColors();
  const isDark = useDSIsDark();
  const t      = useI18n();

  const visible = useStore((s) => s.reviewPromptVisible);
  const setVisible = useStore((s) => s.setReviewPromptVisible);
  const setSubmitted = useStore((s) => s.setLocalReviewSubmitted);

  const [rating, setRating]         = useState(0);
  const [comment, setComment]       = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent]             = useState(false);
  const [error, setError]           = useState<string | null>(null);

  const translateY = useRef(new Animated.Value(0)).current;

  // Reset the sheet's drag position whenever it re-opens.
  useEffect(() => {
    if (visible) translateY.setValue(0);
  }, [visible, translateY]);

  const reset = () => {
    setRating(0);
    setComment('');
    setSubmitting(false);
    setSent(false);
    setError(null);
  };

  const dismiss = () => {
    setVisible(false);
    setTimeout(reset, 250); // wait for the slide-out so content doesn't flicker
  };

  // Slide the sheet the rest of the way down, then close.
  const dismissAnimated = () => {
    Animated.timing(translateY, {
      toValue: SCREEN_H,
      duration: 200,
      useNativeDriver: true,
    }).start(dismiss);
  };

  // Drag-to-dismiss on the handle zone.
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) translateY.setValue(g.dy);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 110 || g.vy > 0.8) {
          dismissAnimated();
        } else {
          Animated.spring(translateY, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
        }
      },
    }),
  ).current;

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
      dismiss();
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
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={dismiss}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.backdrop, { backgroundColor: C.overlay }]}
        pointerEvents="box-none"
      >
        <Animated.View style={[styles.sheet, { backgroundColor: C.background, transform: [{ translateY }] }]}>
          {/* Drag handle — swipe down to dismiss */}
          <View {...pan.panHandlers} style={styles.dragZone}>
            <View style={[styles.handle, { backgroundColor: C.borderStrong }]} />
          </View>

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
                    size={34}
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
              <TouchableOpacity style={[styles.cta, { backgroundColor: C.primary }]} onPress={dismiss} activeOpacity={0.85}>
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
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: DS.radius.xxl,
    borderTopRightRadius: DS.radius.xxl,
    paddingHorizontal: DS.space.lg,
    paddingBottom: DS.space.xl,
    alignItems: 'center',
  },
  dragZone: {
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingTop: DS.space.sm + DS.space.xs,
    paddingBottom: DS.space.md,
  },
  handle: { width: 40, height: 5, borderRadius: 3 },
  stars: {
    flexDirection: 'row',
    gap: DS.space.sm,
    marginBottom: DS.space.md,
  },
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
