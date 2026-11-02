import type { PlanFeatures } from "@/lib/plans";
import { NO_FEATURES, planFeatures } from "@/lib/plans";
import { parseBannedWords } from "@/lib/message-filter";
import { pickMedia, playable, type AlertMedia, type MediaCandidate } from "@/lib/media";
import type { AlertRule } from "@/lib/alert-rules";
import { resolveOverlayStyle, type OverlayStyle } from "@/lib/overlay-themes";
import { baseColours, resolveAlertText, type AlertText } from "@/lib/alert-text";
import { resolveAlertMotion, type AlertMotion } from "@/lib/alert-motion";
import { levelAfterTip, type FanLevel } from "@/lib/fan-levels";
import { istMonthDay, resolveBirthday } from "@/lib/birthday";

// Everything an alert carries besides the fan's name, amount and message: the sound,
// the voice choice, the creator's banned words and (as the paid features ship) media,
// theme, fan level, birthday, voice note and highlight. The overlay route used to look
// these up one after another; they are now read together, each piece on its own so a
// column from a migration that has not been run only drops that piece, never the alert.
//
// The pure half (`resolveAlertExtras`) decides what is shown, so a feature that is
// switched off at play time drops its extras and the plain card plays, and it is
// testable without a database. The query half (`loadAlertExtras`) only reads.

export type Sql = <T extends object[]>(strings: TemplateStringsArray, ...values: unknown[]) => Promise<T> & PromiseLike<T>;

export type AlertSound = { url: string; volume: number; ms: number };

export type AlertExtras = {
  // The fan chose "read my message aloud".
  voiceRequested: boolean;
  bannedWords: string[];
  sound: AlertSound | null;
  // The creator's GIF, image or WebM for this alert (custom alert media); null while
  // the feature is off, the creator has no playable file or this is the message card.
  media: AlertMedia | null;
  // How long the alert stays on screen (alert rules, big tips only), in milliseconds;
  // null is the normal length.
  stayMs: number | null;
  // The card style and font the creator picked (overlay themes); null while the
  // feature is off or both choices are the defaults, which is the plain card.
  theme: OverlayStyle | null;
  // The creator's headline, colours, size and weight (alert text and colours); null while the
  // feature is off or nothing was changed, which is the normal card.
  text: AlertText | null;
  // The creator's animations, length and pause (alert animations and timing); null while the
  // feature is off or nothing was changed, which is the normal card.
  motion: AlertMotion | null;
  // The fan's level after this tip (fan levels); null while the feature is off, the fan has
  // no profile (anonymous, or the tip was before the switch) or this is the message card.
  level: FanLevel | null;
  // The creator's birthday greeting for this tip (birthday message), already filled in
  // with the fan's name; null unless the fan's birthday is today.
  birthday: string | null;
  // Filled in by their features; null while that feature is off or not built.
  voiceNote: null;
  highlight: null;
};

export type RawExtras = {
  voiceRequested: boolean;
  bannedWords: string[];
  sound: AlertSound | null;
  // The creator's uploaded files (all of them; only playable ones are used).
  media?: readonly MediaCandidate[];
  // True when the fan picked this sound on the tip page; a rule never overrides it.
  soundPicked?: boolean;
  // The creator's alert rules, and the one this tip picked on the tip page (alert rules).
  rules?: readonly AlertRule[];
  pickedRuleId?: number | null;
  // The creator's stored theme and font keys (overlay themes); unknown keys are the default.
  style?: { theme?: string | null; font?: string | null } | null;
  // The creator's stored alert text and their accent (alert text and colours); the colours are
  // checked against the card they will sit on.
  alertText?: { value: unknown; accent: string | null } | null;
  // The creator's stored animations, length and pause (alert animations and timing).
  alertMotion?: unknown;
  // The fan's points now and what this tip added (fan levels).
  fan?: { xp: number; tipXp: number } | null;
  // The creator's greeting and the fan's birthday and name on this tip (birthday message).
  birthdayInfo?: { template: string | null; tipBirthday: string | null; name: string | null } | null;
};

export function resolveAlertExtras(
  raw: RawExtras,
  ctx: { kind: "alert" | "message"; features: PlanFeatures; tipId?: number; todayMd?: string },
): AlertExtras {
  // The rule the fan picked on the tip page (a rule never applies to a tip that did not
  // pick it), only on the alert card and only while the creator's switch is on at play time.
  const rule =
    ctx.kind === "alert" && ctx.features.alertRules && raw.pickedRuleId != null
      ? ((raw.rules ?? []).find((r) => r.id === raw.pickedRuleId) ?? null)
      : null;

  // The fan's own pick wins over the rule's sound, which wins over the creator's default.
  const ruleSound = rule && !raw.soundPicked ? rule.sound : null;

  // A rule's media plays when that file is playable and the media switch is on; if it
  // is not (switched off, held, deleted) the tip falls back to the normal rotation.
  const mediaOn = ctx.kind === "alert" && ctx.features.customAlertMedia;
  const ruleFile =
    mediaOn && rule?.mediaId != null
      ? (raw.media ?? []).find((m) => m.id === rule.mediaId && playable(m))
      : undefined;

  return {
    voiceRequested: raw.voiceRequested,
    bannedWords: raw.bannedWords,
    // A voice tip has no sound at all, not even the default; only the alert card has
    // one, not the follow-up message card.
    sound: ctx.kind === "alert" && !raw.voiceRequested ? (ruleSound ?? raw.sound) : null,
    // A voice tip may still show media (only its sound is dropped). Only the alert
    // card has media, and only while the creator's switch is on at play time.
    media: mediaOn ? pickMedia(ruleFile ? [ruleFile] : (raw.media ?? []), ctx.tipId ?? 0) : null,
    // Only the alert card, and only while the rules switch is on at play time.
    stayMs: rule?.stayMs ?? null,
    // Both the alert card and the follow-up message card wear the creator's style.
    theme: ctx.features.overlayThemes ? resolveOverlayStyle(raw.style) : null,
    // Both cards too: the creator's colours and text size apply to the follow-up message card,
    // the headline only to the alert card (see the overlay).
    text:
      ctx.features.alertText && raw.alertText
        ? resolveAlertText(
            raw.alertText.value,
            baseColours(ctx.features.overlayThemes ? raw.style?.theme : null, raw.alertText.accent),
          )
        : null,
    // Both cards come and go the creator's way; the length and pause apply to both too.
    motion: ctx.features.alertMotion ? resolveAlertMotion(raw.alertMotion) : null,
    level: ctx.kind === "alert" && ctx.features.fanLevels && raw.fan ? levelAfterTip(raw.fan.xp, raw.fan.tipXp) : null,
    birthday:
      ctx.kind === "alert" && ctx.features.birthdayMessage && raw.birthdayInfo
        ? resolveBirthday({
            template: raw.birthdayInfo.template,
            tipBirthday: raw.birthdayInfo.tipBirthday,
            todayMd: ctx.todayMd ?? istMonthDay(new Date()),
            name: raw.birthdayInfo.name,
            bannedWords: raw.bannedWords,
          })
        : null,
    voiceNote: null,
    highlight: null,
  };
}

async function safely<T>(label: string, fallback: T, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (err) {
    console.error(`Overlay: could not look up ${label}.`, err);
    return fallback;
  }
}

export async function loadAlertExtras(
  db: Sql,
  o: { tipId: number; creatorId: number; kind: "alert" | "message" },
): Promise<AlertExtras> {
  const [voiceRequested, bannedWords, soundInfo, features] = await Promise.all([
    // Whether the fan chose "read my message aloud" (migration 0014).
    safely("the voice choice", false, async () => {
      const [found] = await db<{ tts_requested: boolean }[]>`
        select tts_requested from tip_orders where id = ${o.tipId}
      `;
      return !!found?.tts_requested;
    }),
    // The creator's banned words (migration 0016); without them nothing is blocked.
    safely("the banned words", [] as string[], async () => {
      const [found] = await db<{ banned_words: string }[]>`
        select banned_words from users where id = ${o.creatorId}
      `;
      return parseBannedWords(found?.banned_words);
    }),
    // The fan's sound pick (even if the creator hid or repriced it afterwards),
    // otherwise the creator's default. Missing sounds table (migration 0013) means
    // a silent alert. Skipped for the message card, which never has a sound.
    o.kind === "alert"
      ? safely("the alert sound", null as { sound: AlertSound; picked: boolean } | null, async () => {
          const [found] = await db<{ blob_url: string; volume: number; duration_ms: number; picked: boolean }[]>`
            select s.blob_url, s.volume, s.duration_ms, (t.sound_id is not null) as picked
            from tip_orders t
            join users u on u.id = t.creator_id
            join creator_sounds s on s.id = coalesce(t.sound_id, u.default_sound_id)
                                 and s.creator_id = u.id
            where t.id = ${o.tipId}
          `;
          return found
            ? { sound: { url: found.blob_url, volume: found.volume, ms: found.duration_ms }, picked: !!found.picked }
            : null;
        })
      : Promise.resolve(null as { sound: AlertSound; picked: boolean } | null),
    // The creator's switches, checked now (play time), not when the fan paid.
    safely("the creator's features", NO_FEATURES, async () => {
      const [found] = await db<{ paid_features: string[] | null }[]>`
        select paid_features from users where id = ${o.creatorId}
      `;
      return planFeatures(found);
    }),
  ]);

  // The creator's files (migration 0036), read only when the feature is on for them.
  const media =
    o.kind === "alert" && features.customAlertMedia
      ? await safely("the alert media", [] as MediaCandidate[], async () => {
          const rows = await db<
            {
              id: string;
              kind: MediaCandidate["kind"];
              blob_url: string;
              placement: MediaCandidate["placement"];
              duration_ms: number | null;
              enabled: boolean;
              review_state: MediaCandidate["review_state"];
            }[]
          >`
            select id::text, kind, blob_url, placement, duration_ms, enabled, review_state
            from creator_media
            where creator_id = ${o.creatorId} and enabled and review_state = 'approved'
            order by id
          `;
          return rows.map((r) => ({ ...r, id: Number(r.id) }));
        })
      : [];

  // The rule this tip picked on the tip page (migrations 0036 and 0043), read only when
  // the feature is on for the creator. A tip that picked none gets no rule.
  let rules: AlertRule[] = [];
  let pickedRuleId: number | null = null;
  if (o.kind === "alert" && features.alertRules) {
    rules = await safely("the alert rule", [] as AlertRule[], async () => {
      const rows = await db<
        { id: string; min_paise: number; media_id: string | null; stay_seconds: number | null; blob_url: string | null; volume: number | null; duration_ms: number | null }[]
      >`
        select r.id::text, r.min_paise, r.media_id::text, r.stay_seconds, s.blob_url, s.volume, s.duration_ms
        from tip_orders t
        join alert_rules r on r.id = t.alert_rule_id and r.creator_id = t.creator_id
        left join creator_sounds s on s.id = r.sound_id and s.creator_id = r.creator_id
        where t.id = ${o.tipId}
      `;
      return rows.map((r) => ({
        id: Number(r.id),
        minPaise: r.min_paise,
        mediaId: r.media_id === null ? null : Number(r.media_id),
        stayMs: r.stay_seconds === null ? null : r.stay_seconds * 1000,
        sound: r.blob_url ? { url: r.blob_url, volume: r.volume ?? 100, ms: r.duration_ms ?? 0 } : null,
      }));
    });
    pickedRuleId = rules[0]?.id ?? null;
  }

  // The creator's card style (migration 0037), read only when the feature is on for them.
  const style = features.overlayThemes
    ? await safely("the alert style", null as { theme: string; font: string } | null, async () => {
        const [found] = await db<{ overlay_theme: string; overlay_font: string }[]>`
          select overlay_theme, overlay_font from users where id = ${o.creatorId}
        `;
        return found ? { theme: found.overlay_theme, font: found.overlay_font } : null;
      })
    : null;

  // The creator's headline and colours (migration 0044), read only when the feature is on.
  const alertText = features.alertText
    ? await safely("the alert text", null as { value: unknown; accent: string | null } | null, async () => {
        const [found] = await db<{ alert_text: unknown; accent: string | null }[]>`
          select alert_text, accent from users where id = ${o.creatorId}
        `;
        return found ? { value: found.alert_text, accent: found.accent } : null;
      })
    : null;

  // The creator's animations, length and pause (migration 0045), read only when the feature is on.
  const alertMotion = features.alertMotion
    ? await safely("the alert motion", null as unknown, async () => {
        const [found] = await db<{ alert_motion: unknown }[]>`select alert_motion from users where id = ${o.creatorId}`;
        return found?.alert_motion ?? null;
      })
    : null;

  // The fan's points (migration 0038), read only when fan levels are on for the creator.
  // The tip's own counted points tell whether it raised the level.
  const fan =
    o.kind === "alert" && features.fanLevels
      ? await safely("the fan level", null as { xp: number; tipXp: number } | null, async () => {
          const [found] = await db<{ xp: string; tip_xp: number }[]>`
            select p.xp::text, e.xp as tip_xp
            from fan_xp_events e
            join fan_profiles p on p.creator_id = e.creator_id and p.fan_key = e.fan_key
            where e.tip_order_id = ${o.tipId}
          `;
          return found ? { xp: Number(found.xp), tipXp: found.tip_xp } : null;
        })
      : null;

  // The greeting and this tip's birthday (migration 0038), read only when the feature is on.
  const birthdayInfo =
    o.kind === "alert" && features.birthdayMessage
      ? await safely("the birthday message", null as { template: string | null; tipBirthday: string | null; name: string | null } | null, async () => {
          const [found] = await db<{ birthday_message: string | null; birthday_md: string | null; fan_name: string | null; anonymous: boolean | null }[]>`
            select u.birthday_message, t.birthday_md, t.fan_name, t.anonymous
            from tip_orders t join users u on u.id = t.creator_id
            where t.id = ${o.tipId}
          `;
          return found
            ? { template: found.birthday_message, tipBirthday: found.birthday_md, name: found.anonymous ? null : found.fan_name }
            : null;
        })
      : null;

  return resolveAlertExtras(
    { voiceRequested, bannedWords, sound: soundInfo?.sound ?? null, soundPicked: soundInfo?.picked ?? false, media, rules, pickedRuleId, style, alertText, alertMotion, fan, birthdayInfo },
    { kind: o.kind, features, tipId: o.tipId },
  );
}
