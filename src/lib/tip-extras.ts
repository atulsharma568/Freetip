// What a fan can attach to a tip besides the amount, name and message. Each field is
// written only when it is set, so every plain tip works before the migration that
// added its column has been run. New paid features (media, voice notes, highlights)
// add their field here, are re-checked on the server in createTipOrder, and are saved
// by the one update there. (Not in the action file: a "use server" file may only
// export async functions.)
export type TipExtras = {
  soundId?: number | null;
  voice?: boolean;
};

// The tip_orders columns the extras set. Pure, so the shape is easy to test.
export function tipExtraColumns(e: { soundId: number | null; voice: boolean }): Record<string, number | boolean> {
  const columns: Record<string, number | boolean> = {};
  if (e.soundId !== null) columns.sound_id = e.soundId;
  if (e.voice) columns.tts_requested = true;
  return columns;
}
