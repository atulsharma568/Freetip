// Which plan-gated features a creator has. Today every creator has all of them: the
// owner has not decided what is paid or what it costs, and no plan or price is shown
// anywhere on the site. When that is decided, change this one function (and add the
// billing); every feature calls it, so nothing else needs to move.
//
// `users.plan` (migration 0026, default 'free') is what a paid plan would set.

export type PlanFeatures = {
  // Phase 1: saved moments, the YouTube comment after the stream and the Discord message.
  timestamps: boolean;
  // Phase 2: moments added by big tips and goals, a public highlights page, the editor link.
  tipMarks: boolean;
  highlightsPage: boolean;
  editorLink: boolean;
  // Phase 3: trimmed video clips from the creator's own OBS.
  clipHelper: boolean;
};

export function planFeatures(plan: string | null | undefined): PlanFeatures {
  void plan;
  return { timestamps: true, tipMarks: true, highlightsPage: true, editorLink: true, clipHelper: true };
}
