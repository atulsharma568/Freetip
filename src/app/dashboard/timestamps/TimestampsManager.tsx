"use client";

import { useState, useTransition } from "react";
import {
  disconnectYouTube,
  generateEditorLink,
  generateTimestampLink,
  removeDiscordWebhook,
  removeEditorLink,
  saveDiscordWebhook,
  saveHighlightsPublic,
  saveTimestampDelay,
  saveTipMarks,
  sendDiscordTest,
  type TsResult,
} from "@/app/actions/timestamps";

const DELAYS = [
  { value: 22, label: "Low delay", note: "Chat and stream almost in step" },
  { value: 42, label: "Normal delay", note: "A middle setting" },
  { value: 58, label: "High delay", note: "Long delay, for example to stop stream sniping" },
] as const;

const tile = "space-y-4 rounded-[var(--radius-surface)] border border-line/60 bg-surface p-6";
const heading = "text-sm font-medium uppercase tracking-widest text-muted";
const primary =
  "inline-flex h-12 items-center rounded-full bg-accent px-6 text-sm font-semibold text-ink transition-opacity duration-200 disabled:opacity-40";
const outline =
  "inline-flex h-11 items-center rounded-full border border-control px-5 text-sm text-text transition-colors hover:border-accent disabled:opacity-40";

function Msg({ result }: { result: TsResult | null }) {
  if (!result) return null;
  return (
    <p role={result.status === "error" ? "alert" : "status"} className={`text-sm ${result.status === "error" ? "text-red-400" : "text-muted"}`}>
      {result.message}
    </p>
  );
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
}) {
  const [command, setCommand] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
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
  const [editorCopied, setEditorCopied] = useState(false);
  const [editorResult, setEditorResult] = useState<TsResult | null>(null);
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<TsResult>, then: (r: TsResult) => void) => start(async () => then(await fn()));

  function makeCommand() {
    if (props.hasLink && !command && !window.confirm("Your current command will stop working. Make a new one?")) return;
    setCopied(false);
    run(generateTimestampLink, (r) => {
      setLinkResult(r);
      if (r.status === "ok" && r.command) setCommand(r.command);
    });
  }

  async function copy() {
    if (!command) return;
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="space-y-6">
      {props.notice && (
        <p role={props.notice.ok ? "status" : "alert"} className={`text-sm ${props.notice.ok ? "text-text" : "text-red-400"}`}>
          {props.notice.text}
        </p>
      )}

      <section className={tile}>
        <h2 className={heading}>1. Connect YouTube</h2>
        <p className="text-sm text-muted">
          This lets Freetip post the timestamps comment from your own channel when the stream ends. It asks
          Google for one extra permission, only for that, and you can take it back here at any time.
        </p>
        {props.reconnectNeeded && (
          <p role="alert" className="text-sm text-red-400">
            Google ended the connection. Connect again so comments can be posted.
          </p>
        )}
        {props.youtubeConnected ? (
          <div className="space-y-3">
            <p className="text-sm text-text">YouTube is connected.</p>
            <button
              type="button"
              className={outline}
              disabled={pending}
              onClick={() => run(disconnectYouTube, (r) => { setYtResult(r); if (r.status === "ok") window.location.reload(); })}
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
      </section>

      <section className={tile}>
        <h2 className={heading}>2. Add the command to your chat bot</h2>
        <p className="text-sm text-muted">
          You need Nightbot (or a bot like StreamElements or Fossabot) in your YouTube chat. Paste the command
          below into your chat once. Set the command&apos;s user level to Moderator if you do not want everyone
          saving moments.
        </p>
        {command ? (
          <div className="space-y-2">
            <label htmlFor="ts-command" className="text-xs text-muted">
              Your command. It is shown once, so copy it now. It holds your private address, so do not show it on stream.
            </label>
            <div className="flex gap-2">
              <input
                id="ts-command"
                readOnly
                value={command}
                onFocus={(e) => e.currentTarget.select()}
                className="numeric h-12 min-w-0 flex-1 rounded-[var(--radius-field)] border border-control bg-ground px-4 text-sm text-text focus:border-accent"
              />
              <button type="button" onClick={copy} className={`${outline} h-12 shrink-0`}>
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted">
            {props.hasLink
              ? "You have a command. For safety it cannot be shown again; make a new one if you lost it."
              : "Make your private command, then paste it into your live chat."}
          </p>
        )}
        <button type="button" className={primary} disabled={pending} onClick={makeCommand}>
          {props.hasLink || command ? "Make a new command" : "Make my command"}
        </button>
        <Msg result={linkResult} />
        <p className="text-xs text-muted">
          After that, anyone allowed can type <span className="numeric">!ts</span> or <span className="numeric">!ts Nice shot</span> in chat.
        </p>
      </section>

      <section className={tile}>
        <h2 className={heading}>3. Delay</h2>
        <p className="text-sm text-muted">
          Viewers see the stream a few seconds late, so a moment is taken this many seconds back. Pick the one
          that matches your stream&apos;s latency setting.
        </p>
        <fieldset className="space-y-2">
          <legend className="sr-only">Delay in seconds</legend>
          {DELAYS.map((d) => (
            <label
              key={d.value}
              className={`flex cursor-pointer items-center justify-between gap-3 rounded-[var(--radius-field)] border px-4 py-3 text-sm ${
                delay === d.value ? "border-accent text-text" : "border-control text-muted"
              }`}
            >
              <span>
                {d.label} <span className="text-xs text-muted">({d.note})</span>
              </span>
              <span className="numeric">{d.value}s</span>
              <input type="radio" name="ts-delay" className="sr-only" checked={delay === d.value} onChange={() => setDelay(d.value)} />
            </label>
          ))}
        </fieldset>
        <button type="button" className={outline} disabled={pending || delay === props.delay} onClick={() => run(() => saveTimestampDelay(delay), setDelayResult)}>
          Save delay
        </button>
        <Msg result={delayResult} />
      </section>

      <section className={tile}>
        <h2 className={heading}>Send moments to Discord (optional)</h2>
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
            className="h-12 w-full rounded-[var(--radius-field)] border border-control bg-ground px-4 text-sm text-text placeholder:text-muted focus:border-accent"
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
      </section>

      {!props.extras.ready ? (
        <p role="alert" className="text-sm text-red-400">
          More options are coming: run db/migrations/0033_timestamp_extras.sql in Neon.
        </p>
      ) : (
        <>
          {props.tipPlan && (
            <section className={tile}>
              <h2 className={heading}>Mark big tips and goals automatically</h2>
              <p className="text-sm text-muted">
                When a big tip&apos;s alert plays on your stream, or a goal bar is completed, Freetip adds a
                moment by itself, so those moments are never missed. It shows only the amount or the goal&apos;s
                title, never a fan&apos;s name. Needs YouTube connected (above).
              </p>
              <label className="flex items-center gap-3 text-sm text-text">
                <input type="checkbox" checked={tipOn} onChange={(e) => setTipOn(e.target.checked)} className="h-5 w-5 accent-[var(--color-accent)]" />
                Add moments for big tips and completed goals
              </label>
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
                    className="numeric h-12 w-40 rounded-[var(--radius-field)] border border-control bg-ground px-4 text-sm text-text focus:border-accent"
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
            </section>
          )}

          {props.highlightsPlan && (
            <section className={tile}>
              <h2 className="text-sm font-medium uppercase tracking-widest text-muted">Public highlights pages</h2>
              <p className="text-sm text-muted">
                Give each stream a public page of its moments. Every time is a link that opens the video at
                that second, with a button to tip you. It shows times and what was typed, never a viewer&apos;s
                name. The link for each stream appears under Recent streams.
              </p>
              <label className="flex items-center gap-3 text-sm text-text">
                <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} className="h-5 w-5 accent-[var(--color-accent)]" />
                Make highlights pages public
              </label>
              <button type="button" className={outline} disabled={pending} onClick={() => run(() => saveHighlightsPublic(isPublic), setPublicResult)}>
                Save
              </button>
              <Msg result={publicResult} />
            </section>
          )}

          {props.editorPlan && (
            <section className={tile}>
              <h2 className="text-sm font-medium uppercase tracking-widest text-muted">Link for your video editor</h2>
              <p className="text-sm text-muted">
                A private page that lists every moment, the most-marked first, with a CSV download and the
                moments ready to paste as YouTube chapters. Your editor needs no account. Anyone with the link
                can see it, so send it only to them.
              </p>
              {editorLink && (
                <div className="space-y-2">
                  <label htmlFor="ts-editor-link" className="text-xs text-muted">
                    Your editor link. It is shown once, so copy it now.
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="ts-editor-link"
                      readOnly
                      value={editorLink}
                      onFocus={(e) => e.currentTarget.select()}
                      className="numeric h-12 min-w-0 flex-1 rounded-[var(--radius-field)] border border-control bg-ground px-4 text-sm text-text focus:border-accent"
                    />
                    <button
                      type="button"
                      className={`${outline} h-12 shrink-0`}
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(editorLink);
                          setEditorCopied(true);
                        } catch {
                          setEditorCopied(false);
                        }
                      }}
                    >
                      {editorCopied ? "Copied" : "Copy"}
                    </button>
                  </div>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={primary}
                  disabled={pending}
                  onClick={() => {
                    if (props.extras.hasEditorLink && !editorLink && !window.confirm("The current link will stop working. Make a new one?")) return;
                    setEditorCopied(false);
                    run(generateEditorLink, (r) => {
                      setEditorResult(r);
                      if (r.status === "ok" && r.command) setEditorLink(r.command);
                    });
                  }}
                >
                  {props.extras.hasEditorLink || editorLink ? "Make a new link" : "Make an editor link"}
                </button>
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
            </section>
          )}
        </>
      )}
    </div>
  );
}
