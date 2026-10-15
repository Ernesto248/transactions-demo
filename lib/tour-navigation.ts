type TourContinuation = {
  isLastStep: boolean;
  isReview: boolean;
  requiresAction?: boolean;
  actionComplete?: () => boolean;
  prepareNext?: () => void;
  canContinue?: () => boolean;
};

type TourNavigation = {
  advance: () => void;
  finish: () => void;
  notify: (message: string) => void;
};

export function continueTourStep(step: TourContinuation, navigation: TourNavigation) {
  if (step.isLastStep) {
    navigation.finish();
    return;
  }
  if (!step.isReview) {
    if (step.requiresAction && !step.actionComplete?.() && !step.prepareNext) {
      navigation.notify("Completa la acción señalada para continuar.");
      return;
    }
    if (step.canContinue && !step.canContinue()) return;
    step.prepareNext?.();
  }
  navigation.advance();
}
