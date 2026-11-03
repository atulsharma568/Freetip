"use client";

import { useState, useTransition } from "react";
import {
  disconnectYouTube,
  generateEditorLink,
  generateHelperToken,
  generateTimestampLink,
  removeDiscordWebhook,
  removeEditorLink,
  removeHelperToken,
  saveDiscordWebhook,
  saveHighlightsPublic,
  saveTimestampDelay,
  saveTipMarks,
  sendDiscordTest,
  type TsResult,
} from "@/app/actions/timestamps";
import { Tile } from "../parts/Tile";
import { Msg as StatusLine } from "../parts/Msg";
import { ConfirmAction } from "../parts/ConfirmAction";
import { CopyField } from "../parts/CopyField";
import { OptionRadio, Toggle } from "../parts/Controls";
import { field, pillOutline, pillPrimary } from "../parts/styles";

const DELAYS = [
  { value: 22, label: "Low delay", note: "Chat and stream almost in step" },
  { value: 42, label: "Normal delay", note: "A middle setting" },
  { value: 58, label: "High delay", note: "Long delay, for example to stop stream sniping" },
] as const;

const primary = pillPrimary;
const outline = pillOutline;

// A result from an action, in the always-present status line.
function Msg({ result }: { result: TsResult | null }) {
  return <StatusLine kind={result ? (result.status === "error" ? "error" : "info") : undefined} text={result?.message} />;
}

export function TimestampsManager(props: {
  available: boolean;
  hasLink: boolean;
  delay: number;
  youtubeConnected: boolean;
  reconnectNeeded: boolean;
  discordConnected: boolean;
  notice: { ok: boolean; text: string } | null;
  extras: { tipMinRupees: number | null; isPublic: boolean; hasEditorLink: boolean; ready: boolean };
  tipPlan: boolean;
  highlightsPlan: boolean;
  editorPlan: boolean;
  clipPlan: boolean;
  helper: { hasToken: boolean; seenSecondsAgo: number | null; ready: boolean };
  // Replay buffer seconds OBS needs at the saved delay; the page adds to it when the delay changes.
  bufferSeconds: number;
}) {
  const [command, setCommand] = useState<string | null>(null);
  const [linkResult, setLinkResult] = useState<TsResult | null>(null);
  const [delay, setDelay] = useState<number>(props.delay);
  const [delayResult, setDelayResult] = useState<TsResult | null>(null);
  const [webhook, setWebhook] = useState("");
  const [discordResult, setDiscordResult] = useState<TsResult | null>(null);
  const [ytResult, setYtResult] = useState<TsResult | null>(null);
  const [tipOn, setTipOn] = useState(props.extras.tipMinRupees !== null);
  const [tipMin, setTipMin] = useState(String(props.extras.tipMinRupees ?? 500));
  const [tipResult, setTipResult] = useState<TsResult | null>(null);
  const [isPublic, setIsPublic] = useState(props.extras.isPublic);
  const [publicResult, setPublicResult] = useState<TsResult | null>(null);
  const [editorLink, setEditorLink] = useState<string | null>(null);
  const [editorResult, setEditorResult] = useState<TsResult | null>(null);
  const [helperToken, setHelperToken] = useState<string | null>(null);
  const [helperResult, setHelperResult] = useState<TsResult | null>(null);
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<TsResult>, then: (r: TsResult) => void) => start(async () => then(await fn()));

  function makeCommand() {
    run(generateTimestampLink, (r) => {
      setLinkResult(r);
      if (r.status === "ok" && r.command) setCommand(r.command);
    });
  }

  return (
    <div className="space-y-6">
      {props.notice && (
        <StatusLine kind={props.notice.ok ? "ok" : "error"} text={props.notice.text} />
      )}

      <Tile id="ts-youtube" level={2} title="1. Connect YouTube">
        <p className="text-sm text-muted">
          This lets Freetip post the timestamps comment from your own channel when the stream ends. It asks
          Google for one extra permission, only for that, and you can take it back here at any time.
        </p>
        {props.reconnectNeeded && (
          <StatusLine kind="error" text="Google ended the connection. Connect again so comments can be posted." />
        )}
        {props.youtubeConnected ? (
          <div className="space-y-3">
            <p className="text-sm text-text">YouTube is connected.</p>
            <button
              type="button"
              className={outline}
              disabled={pending}
              onClick={() => run(disconnectYouTube, (r) => { setYtResult(r); if (r.status === "ok") window.location.replace("/dashboard/timestamps"); })}
            >
              Disconnect YouTube
            </button>
            <Msg result={ytResult} />
          </div>
        ) : props.available ? (
          <form action="/api/yt-connect/start" method="get">
            <button type="submit" className={primary}>
              Connect YouTube
            </button>
          </form>
        ) : (
          <p className="text-sm text-muted">Not switched on for the site yet.</p>
        )}
      </Tile>

      <Tile id="ts-command" level={2} title="2. Add the command to your chat bot">
        <p className="text-sm text-muted">
          You need Nightbot (or a bot like StreamElements or Fossabot) in your YouTube chat. Paste the command
          below into your chat once. Set the command&apos;s user level to Moderator if you do not want everyone
          saving moments.
        </p>
        {command ? (
          <CopyField
            id="ts-command-value"
            value={command}
            label="Your command. It is shown once, so copy it now."
            note="It holds your private address, so do not show it on stream."
          />
        ) : (
          <p className="text-sm text-muted">
            {props.hasLink
              ? "You have a command. For safety it cannot be shown again; make a new one if you lost it."
              : "Make your private command, then paste it into your live chat."}
          </p>
        )}
        <ConfirmAction
          ask={props.hasLink && !command}
          prompt="Your current command will stop working. Make a new one?"
          confirmLabel="Yes, make a new command"
          keepLabel="Keep my command"
          onConfirm={makeCommand}
          disabled={pending}
          className={primary}
        >
          {props.hasLink || command ? "Make a new command" : "Make my command"}
        </ConfirmAction>
        <Msg result={linkResult} />
        <p className="text-xs text-muted">
          After that, anyone allowed can type <span className="numeric">!ts</span> or <span className="numeric">!ts Nice shot</span> in chat.
        </p>
      </Tile>

      <Tile id="ts-delay" level={2} title="3. Delay">
        <p className="text-sm text-muted">
          Viewers see the stream a few seconds late, so a moment is taken this many seconds back. Pick the one
          that matches your stream&apos;s latency setting.
        </p>
        <fieldset className="space-y-2">
          <legend className="sr-only">Delay in seconds</legend>
          {DELAYS.map((d) => (
            <OptionRadio
              key={d.value}
              name="ts-delay"
              value={d.value}
              checked={delay === d.value}
              onChange={() => setDelay(d.value)}
              hint={d.note}
            >
              <span className="flex items-baseline justify-between gap-3">
                {d.label}
                <span className="numeric font-normal">{d.value}s</span>
              </span>
            </OptionRadio>
          ))}
        </fieldset>
        <button type="button" className={outline} disabled={pending || delay === props.delay} onClick={() => run(() => saveTimestampDelay(delay), setDelayResult)}>
          Save delay
        </button>
        <Msg result={delayResult} />
      </Tile>

      <Tile id="ts-discord" level={2} title="Send moments to Discord (optional)">
        <p className="text-sm text-muted">
          Each saved moment is posted to a Discord channel with the stream title, who saved it, what they wrote,
          the time, and a link that opens your stream at that second. It is a link to the moment, not a video file.
        </p>
        <p className="text-xs text-muted">
          In Discord: channel settings, Integrations, Webhooks, New webhook, Copy webhook URL. Paste it here. It
          is stored encrypted and not shown again.
        </p>
        {props.discordConnected && <p className="text-sm text-text">Discord is connected.</p>}
        <div className="space-y-2">
          <label htmlFor="ts-webhook" className="text-xs text-muted">
            {props.discordConnected ? "Replace the webhook URL" : "Webhook URL"}
          </label>
          <input
            id="ts-webhook"
            type="password"
            autoComplete="off"
            value={webhook}
            onChange={(e) => setWebhook(e.target.value)}
            placeholder="https://discord.com/api/webhooks/…"
            className={field}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={primary}
            disabled={pending || !webhook.trim()}
            onClick={() => run(() => saveDiscordWebhook(webhook), (r) => { setDiscordResult(r); if (r.status === "ok") { setWebhook(""); window.location.reload(); } })}
          >
            {props.discordConnected ? "Replace" : "Connect Discord"}
          </button>
          {props.discordConnected && (
            <>
              <button type="button" className={outline} disabled={pending} onClick={() => run(sendDiscordTest, setDiscordResult)}>
                Send test message
              </button>
              <button type="button" className={outline} disabled={pending} onClick={() => run(removeDiscordWebhook, (r) => { setDiscordResult(r); if (r.status === "ok") window.location.reload(); })}>
                Disconnect
              </button>
            </>
          )}
        </div>
        <Msg result={discordResult} />
      </Tile>

      {!props.extras.ready ? (
        <StatusLine kind="error" text="More options are coming: run db/migrations/0033_timestamp_extras.sql in Neon." />
      ) : (
        <>
          {props.tipPlan && (
            <Tile id="ts-tips" level={2} title="Mark big tips and goals automatically">
              <p className="text-sm text-muted">
                When a big tip&apos;s alert plays on your stream, or a goal bar is completed, Freetip adds a
                moment by itself, so those moments are never missed. It shows only the amount or the goal&apos;s
                title, never a fan&apos;s name. Needs YouTube connected (above).
              </p>
              <Toggle id="ts-tip-on" checked={tipOn} onChange={setTipOn}>
                Add moments for big tips and completed goals
              </Toggle>
              {tipOn && (
                <div className="space-y-2">
                  <label htmlFor="ts-tip-min" className="text-xs text-muted">
                    Tips of this many rupees or more (at least 20)
                  </label>
                  <input
                    id="ts-tip-min"
                    inputMode="numeric"
                    value={tipMin}
                    onChange={(e) => setTipMin(e.target.value.replace(/\D/g, "").slice(0, 7))}
                    className={`${field} numeric w-40`}
                  />
                </div>
              )}
              <button
                type="button"
                className={outline}
                disabled={pending}
                onClick={() => run(() => saveTipMarks(tipOn ? Number(tipMin) : null), setTipResult)}
              >
                Save
              </button>
              <Msg result={tipResult} />
            </Tile>
          )}

          {props.highlightsPlan && (
            <Tile id="ts-public" level={2} title="Public highlights pages">
              <p className="text-sm text-muted">
                Give each stream a public page of its moments. Every time is a link that opens the video at
                that second, with a button to tip you. It shows times and what was typed, never a viewer&apos;s
                name. The link for each stream appears under Recent streams.
              </p>
              <Toggle id="ts-public-on" checked={isPublic} onChange={setIsPublic}>
                Make highlights pages public
              </Toggle>
              <button type="button" className={outline} disabled={pending} onClick={() => run(() => saveHighlightsPublic(isPublic), setPublicResult)}>
                Save
              </button>
              <Msg result={publicResult} />
            </Tile>
          )}

          {props.editorPlan && (
            <Tile id="ts-editor" level={2} title="Link for your video editor">
              <p className="text-sm text-muted">
                A private page that lists every moment, the most-marked first, with a CSV download and the
                moments ready to paste as YouTube chapters. Your editor needs no account. Anyone with the link
                can see it, so send it only to them.
              </p>
              {editorLink && (
                <CopyField id="ts-editor-link" value={editorLink} label="Your editor link. It is shown once, so copy it now." />
              )}
              <div className="flex flex-wrap gap-2">
                <ConfirmAction
                  ask={props.extras.hasEditorLink && !editorLink}
                  prompt="The current link will stop working. Make a new one?"
                  confirmLabel="Yes, make a new link"
                  keepLabel="Keep the link"
                  disabled={pending}
                  className={primary}
                  onConfirm={() =>
                    run(generateEditorLink, (r) => {
                      setEditorResult(r);
                      if (r.status === "ok" && r.command) setEditorLink(r.command);
                    })
                  }
                >
                  {props.extras.hasEditorLink || editorLink ? "Make a new link" : "Make an editor link"}
                </ConfirmAction>
                {(props.extras.hasEditorLink || editorLink) && (
                  <button
                    type="button"
                    className={outline}
                    disabled={pending}
                    onClick={() => run(removeEditorLink, (r) => { setEditorResult(r); if (r.status === "ok") { setEditorLink(null); window.location.reload(); } })}
                  >
                    Remove the link
                  </button>
                )}
              </div>
              <Msg result={editorResult} />
            </Tile>
          )}

          {props.clipPlan && (
            <Tile id="ts-clips" level={2} title="Video clips from your own recording">
              <p className="text-sm text-muted">
                YouTube gives nobody a way to cut a clip out of a stream, so this uses the recording OBS makes
                on your own PC. A small helper program runs next to OBS. For each moment saved here it waits
                10 seconds, saves OBS&apos;s replay buffer, cuts the 30 seconds around the moment and uploads
                that clip to your Discord. The video and your Discord address stay on your PC: Freetip only
                tells the helper which moments were saved.
              </p>
              {!props.helper.ready ? (
                <StatusLine kind="error" text="Not ready yet: run db/migrations/0034_clip_helper.sql in Neon." />
              ) : (
                <>
                  <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
                    <li>
                      In OBS, turn on the replay buffer (Settings, Output) and set it to at least{" "}
                      <span className="numeric text-text">{props.bufferSeconds + (delay - props.delay)} seconds</span>{" "}
                      for your delay setting.
                    </li>
                    <li>
                      In OBS, Tools, WebSocket Server Settings: turn the server on. OBS 28 or newer has it built in.
                    </li>
                    <li>
                      Download the helper, put the token below and a Discord webhook address into its config file,
                      and start it. Steps are in the{" "}
                      <a
                        href="https://github.com/atulsharma568/Freetip/tree/main/tools/obs-clip-helper"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-text underline-offset-4 hover:underline"
                      >
                        helper&apos;s instructions
                      </a>
                      .
                    </li>
                    <li>Discord only takes small files, so clips are squeezed to about 10 MB.</li>
                  </ul>
                  {props.helper.hasToken && (
                    <StatusLine
                      kind="info"
                      text={
                        props.helper.seenSecondsAgo !== null && props.helper.seenSecondsAgo < 90
                          ? "The helper is running."
                          : "The helper has not been seen in the last minute and a half."
                      }
                    />
                  )}
                  {helperToken && (
                    <CopyField id="ts-helper-token" value={helperToken} label="Your helper token. It is shown once, so copy it now." />
                  )}
                  <div className="flex flex-wrap gap-2">
                    <ConfirmAction
                      ask={props.helper.hasToken && !helperToken}
                      prompt="The helper using the current token will stop. Make a new token?"
                      confirmLabel="Yes, make a new token"
                      keepLabel="Keep the token"
                      disabled={pending}
                      className={primary}
                      onConfirm={() =>
                        run(generateHelperToken, (r) => {
                          setHelperResult(r);
                          if (r.status === "ok" && r.command) setHelperToken(r.command);
                        })
                      }
                    >
                      {props.helper.hasToken || helperToken ? "Make a new token" : "Make a helper token"}
                    </ConfirmAction>
                    {(props.helper.hasToken || helperToken) && (
                      <button
                        type="button"
                        className={outline}
                        disabled={pending}
                        onClick={() => run(removeHelperToken, (r) => { setHelperResult(r); if (r.status === "ok") { setHelperToken(null); window.location.reload(); } })}
                      >
                        Remove the token
                      </button>
                    )}
                  </div>
                  <Msg result={helperResult} />
                </>
              )}
            </Tile>
          )}
        </>
      )}
    </div>
  );
}
