import { useStore } from '@/store/useStore';
import { track } from '@/utils/analytics';

// Happy-path review prompt.
//
// After the user has clearly gotten value out of the app (a few successful translations),
// and only at a handful of usage milestones, we surface an in-app review modal
// (see components/LocalReviewPrompt). 5 stars → the native store sheet; 1–4 stars →
// private feedback POSTed to our backend. We stop nagging once they've submitted once.
const REVIEW_MILESTONES = [2, 10, 20];

/**
 * Records one successful translation and, if the user just crossed the next usage
 * milestone (and hasn't reviewed yet), opens the in-app review modal. Fire-and-forget:
 * call it on the happy path and don't await it.
 */
export async function maybeAskForReview(): Promise<void> {
  const state = useStore.getState();
  const count = state.bumpSuccessfulTranslations();
  const promptedTimes = state.reviewPromptCount;

  if (state.localReviewSubmitted) return;                 // already reviewed — never nag again
  if (promptedTimes >= REVIEW_MILESTONES.length) return;  // used up our milestones
  if (count < REVIEW_MILESTONES[promptedTimes]) return;   // not at the next milestone yet

  state.incrementReviewPromptCount();
  state.setReviewPromptVisible(true);
  track('local_review_prompted', { milestone: REVIEW_MILESTONES[promptedTimes] });
}
