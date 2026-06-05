import * as StoreReview from 'expo-store-review';
import { useStore } from '@/store/useStore';

// Happy-path App Store review prompt.
//
// We only ask the system to surface the native review sheet after the user has clearly
// gotten value out of the app (a few successful translations), and only at a handful of
// usage milestones. iOS itself rate-limits SKStoreReviewController to ~3 prompts / 365
// days and silently no-ops the rest, so these milestones are an upper bound — most users
// see the sheet at most once. We never block translation on this; it's strictly best-effort.
const REVIEW_MILESTONES = [2, 10, 20];

/**
 * Records one successful translation and, if the user just crossed the next usage
 * milestone, asks iOS to present the native "rate this app" sheet. Fire-and-forget:
 * call it on the happy path and don't await it.
 */
export async function maybeAskForReview(): Promise<void> {
  const state = useStore.getState();
  const count = state.bumpSuccessfulTranslations();
  const promptedTimes = state.reviewPromptCount;

  // Already asked at every milestone we're willing to use.
  if (promptedTimes >= REVIEW_MILESTONES.length) return;

  // Haven't reached the next milestone yet.
  if (count < REVIEW_MILESTONES[promptedTimes]) return;

  try {
    if (!(await StoreReview.isAvailableAsync())) return;
    await StoreReview.requestReview();
    // Count the attempt regardless of whether iOS actually rendered the sheet — there's
    // no callback telling us if it showed, and retrying would only risk nagging.
    state.incrementReviewPromptCount();
  } catch {
    // Best-effort: never let a review-prompt failure bubble into the translation flow.
  }
}
