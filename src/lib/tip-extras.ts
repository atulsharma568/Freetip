// What a fan can attach to a tip besides the amount, name and message. Each field is
// written only when it is set, so every plain tip works before the migration that
// added its column has been run. New paid features (media, voice notes, highlights)
// add their field here, are re-checked on the server in createTipOrder, and are saved
// by the one update there. (Not in the action file: a "use server" file may only
// export async functions.)
export type TipExtras = {
  soundId?: number | null;
  voice?: boolean;
  // The fan asked for their message to be pinned on stream (paid highlighted messages);
  // only used when the creator offers it, the tip is big enough and there is a message.
  pin?: boolean;
  // The creator's alert rule (GIF and/or sound at a fixed amount) the fan tapped; excludes a
  // message, a sound and the voice, and is checked on the server.
  ruleId?: number | null;
};

// The tip_orders columns the extras set. Pure, so the shape is easy to test.
export function tipExtraColumns(e: {
  soundId: number | null;
  voice: boolean;
  pin?: boolean;
  ruleId?: number | null;
}): Record<string, number | boolean | string> {
  const columns: Record<string, number | boolean | string> = {};
  if (e.pin) columns.highlight = true;
  if (e.ruleId != null) columns.alert_rule_id = e.ruleId;
  if (e.soundId !== null) columns.sound_id = e.soundId;
  if (e.voice) columns.tts_requested = true;
  return columns;
}
