// What a fan can attach to a tip besides the amount, name and message. Each field is
// written only when it is set, so every plain tip works before the migration that
// added its column has been run. New paid features (media, voice notes, highlights)
// add their field here, are re-checked on the server in createTipOrder, and are saved
// by the one update there. (Not in the action file: a "use server" file may only
// export async functions.)
export type TipExtras = {
  soundId?: number | null;
  voice?: boolean;
  // The fan's birthday as typed on the tip page (birthday message); only used when the
  // creator offers it, the tip has a name, and it is a real day.
  birthday?: { month: number; day: number } | null;
};

// The tip_orders columns the extras set. Pure, so the shape is easy to test.
export function tipExtraColumns(e: {
  soundId: number | null;
  voice: boolean;
  birthdayMd?: string | null;
}): Record<string, number | boolean | string> {
  const columns: Record<string, number | boolean | string> = {};
  if (e.birthdayMd) columns.birthday_md = e.birthdayMd;
  if (e.soundId !== null) columns.sound_id = e.soundId;
  if (e.voice) columns.tts_requested = true;
  return columns;
}
