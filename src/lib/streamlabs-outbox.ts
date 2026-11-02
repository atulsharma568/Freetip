import type { LedgerDb } from "./accrual";
import type { AlertMode, MessageStatus } from "./alerts";
import { parseBannedWords } from "./message-filter";
import { planFeatures } from "./plans";
import { open, seal } from "./secret-box";
import {
  MAX_ATTEMPTS,
  MIN_GAP_MS,
  TEST_ALERT,
  alertMessage,
  alertName,
  buildAlert,
  needsRefresh,
  postAlert,
  refreshTokens,
  retryDelayMs,
  sendDecision,
  type AlertPayload,
  type StreamlabsDeps,
  type Tokens,
} from "./streamlabs";

// The database side of the Streamlabs bridge (migration 0041). A paid tip is queued after
// capture and sent from the queue, so nothing here can hold up or undo a tip or the books.
// Tokens are only ever opened to make a call, and never logged or returned to a browser.

export type EnqueueResult =
  | { status: "queued" }
  | { status: "already" }
  | { status: "skipped"; reason: "no_such_payment" | "not_captured" | "test_mode" | "feature_off" | "not_connected" };

// Called from the capture step. Test-mode money is never sent, and nothing is queued for a
// creator who is not connected or has the feature off at that moment.
export async function enqueueStreamlabsAlert(db: LedgerDb, paymentRef: string): Promise<EnqueueResult> {
  const [tip] = await db<
    {
      tip_id: string;
      creator_id: string;
      status: string;
      livemode: boolean | null;
      paid_features: string[] | null;
      connected: boolean;
      reconnect_needed: boolean | null;
    }[]
  >`
    select t.id::text as tip_id, t.creator_id::text as creator_id, t.status, pa.livemode, u.paid_features,
           (c.creator_id is not null) as connected, c.reconnect_needed
      from payment_attempts pa
      join tip_orders t on t.id = pa.tip_order_id
      join users u on u.id = t.creator_id
      left join streamlabs_connections c on c.creator_id = t.creator_id
     where pa.provider_payment_ref = ${paymentRef}
  `;
  if (!tip) return { status: "skipped", reason: "no_such_payment" };
  if (tip.status !== "captured") return { status: "skipped", reason: "not_captured" };
  if (tip.livemode !== true) return { status: "skipped", reason: "test_mode" };
  if (!planFeatures({ paid_features: tip.paid_features }).streamlabs) return { status: "skipped", reason: "feature_off" };
  if (!tip.connected || tip.reconnect_needed) return { status: "skipped", reason: "not_connected" };

  const inserted = await db<{ tip_order_id: string }[]>`
    insert into streamlabs_outbox (tip_order_id, creator_id)
    values (${tip.tip_id}::bigint, ${tip.creator_id}::bigint)
    on conflict (tip_order_id) do nothing
    returning tip_order_id::text
  `;
  return inserted.length ? { status: "queued" } : { status: "already" };
}

type Conn = {
  access_token_enc: string;
  refresh_token_enc: string | null;
  expires_at: Date | null;
  reconnect_needed: boolean;
  last_sent_at: Date | null;
};

type Delivery =
  | { kind: "sent" }
  | { kind: "reconnect" }
  | { kind: "rejected" | "rate" | "retry"; status: number | null };

const iso = (d: Date | null) => (d ? d.toISOString() : null);

async function saveTokens(db: LedgerDb, creatorId: string, tokens: Tokens, keepRefresh: string | null) {
  const refresh = tokens.refreshToken ?? keepRefresh;
  await db`
    update streamlabs_connections
       set access_token_enc  = ${seal(tokens.accessToken)}::text,
           refresh_token_enc = ${refresh ? seal(refresh) : null}::text,
           expires_at        = ${iso(tokens.expiresAt)}::timestamptz
     where creator_id = ${creatorId}::bigint
  `;
}

// Posts one alert for a creator: refreshes the token first if it is about to expire, and
// once more if Streamlabs refuses it, then reports what happened.
async function deliver(
  db: LedgerDb,
  creatorId: string,
  conn: Conn,
  payload: AlertPayload,
  deps: StreamlabsDeps,
): Promise<Delivery> {
  let access = open(conn.access_token_enc);
  let refresh = open(conn.refresh_token_enc);
  // A key that changed makes the stored token unreadable: the creator reconnects.
  if (!access) return { kind: "reconnect" };

  let refreshed = false;
  const doRefresh = async (): Promise<"ok" | "invalid" | "error"> => {
    if (!refresh) return "invalid";
    const result = await refreshTokens(refresh, deps);
    if (result.status !== "ok") return result.status;
    access = result.tokens.accessToken;
    await saveTokens(db, creatorId, result.tokens, refresh);
    refresh = result.tokens.refreshToken ?? refresh;
    refreshed = true;
    return "ok";
  };

  if (needsRefresh(conn.expires_at, deps.now())) {
    const r = await doRefresh();
    if (r === "invalid") return { kind: "reconnect" };
    if (r === "error") return { kind: "retry", status: null };
  }

  let result = await postAlert(access, payload, deps);
  if (!result.ok && result.kind === "auth" && !refreshed) {
    const r = await doRefresh();
    if (r === "invalid") return { kind: "reconnect" };
    if (r === "error") return { kind: "retry", status: null };
    result = await postAlert(access, payload, deps);
  }
  if (result.ok) return { kind: "sent" };
  if (result.kind === "auth") return { kind: "reconnect" };
  return { kind: result.kind, status: result.status };
}

async function markReconnect(db: LedgerDb, creatorId: string, now: Date) {
  await db`
    update streamlabs_connections
       set reconnect_needed = true, last_error = 'Streamlabs asked us to sign in again.', last_error_at = ${now.toISOString()}::timestamptz
     where creator_id = ${creatorId}::bigint
  `;
}

async function recordError(db: LedgerDb, creatorId: string, text: string, now: Date) {
  await db`
    update streamlabs_connections
       set last_error = ${text}::text, last_error_at = ${now.toISOString()}::timestamptz
     where creator_id = ${creatorId}::bigint
  `;
}

export interface OutboxSummary {
  sent: number;
  dropped: number;
  waiting: number;
  retried: number;
}

type DueRow = {
  tip_id: string;
  creator_id: string;
  attempts: number;
  fan_name: string | null;
  fan_message: string | null;
  anonymous: boolean | null;
  gross: string;
  message_status: MessageStatus;
  captured_at: Date;
  message_decided_at: Date | null;
  highlight: boolean | null;
  alert_mode: AlertMode | null;
  banned_words: string | null;
  paid_features: string[] | null;
};

// Sends what is due, at most `limit` alerts. Safe to call from the capture step and from
// the cron at the same time: each row is leased before it is sent, so it goes out once.
export async function processOutbox(db: LedgerDb, deps: StreamlabsDeps, limit = 20): Promise<OutboxSummary> {
  const summary: OutboxSummary = { sent: 0, dropped: 0, waiting: 0, retried: 0 };
  const start = deps.now();
  const due = await db<DueRow[]>`
    select o.tip_order_id::text as tip_id, o.creator_id::text as creator_id, o.attempts,
           t.fan_name, t.fan_message, t.anonymous, t.gross_amount_minor::text as gross, t.message_status,
           t.captured_at, t.message_decided_at, t.highlight,
           u.alert_mode, u.banned_words, u.paid_features
      from streamlabs_outbox o
      join tip_orders t on t.id = o.tip_order_id
      join users u on u.id = o.creator_id
     where o.state = 'queued' and o.next_attempt_at <= ${start.toISOString()}::timestamptz
     order by o.next_attempt_at, o.created_at
     limit ${limit}::int
  `;

  const drop = async (row: DueRow, reason: string, attempts = row.attempts) => {
    await db`
      update streamlabs_outbox set state = 'dropped', reason = ${reason}::text, attempts = ${attempts}::int
       where tip_order_id = ${row.tip_id}::bigint
    `;
    summary.dropped += 1;
  };
  const later = async (row: DueRow, at: Date, attempts = row.attempts) => {
    await db`
      update streamlabs_outbox set next_attempt_at = ${at.toISOString()}::timestamptz, attempts = ${attempts}::int
       where tip_order_id = ${row.tip_id}::bigint
    `;
  };

  for (const row of due) {
    const now = deps.now();
    // Lease the row for two minutes so a second worker skips it.
    const lease = new Date(now.getTime() + 120_000);
    const claimed = await db<{ tip_order_id: string }[]>`
      update streamlabs_outbox set next_attempt_at = ${lease.toISOString()}::timestamptz
       where tip_order_id = ${row.tip_id}::bigint and state = 'queued'
         and next_attempt_at <= ${start.toISOString()}::timestamptz
       returning tip_order_id::text
    `;
    if (!claimed.length) continue;

    if (!planFeatures({ paid_features: row.paid_features }).streamlabs) {
      await drop(row, "feature_off");
      continue;
    }
    const [conn] = await db<Conn[]>`
      select access_token_enc, refresh_token_enc, expires_at, reconnect_needed, last_sent_at
        from streamlabs_connections where creator_id = ${row.creator_id}::bigint
    `;
    if (!conn) {
      await drop(row, "disconnected");
      continue;
    }
    if (conn.reconnect_needed) {
      await drop(row, "reconnect_needed");
      continue;
    }

    const decision = sendDecision({
      mode: row.alert_mode ?? "split",
      hasMessage: !!row.fan_message?.trim(),
      status: row.message_status,
      pinned: !!row.highlight,
      capturedAt: row.captured_at,
      decidedAt: row.message_decided_at,
      now,
    });
    if (decision === "too_late") {
      await drop(row, "too_late");
      continue;
    }
    if (decision === "wait") {
      await later(row, new Date(now.getTime() + 60_000));
      summary.waiting += 1;
      continue;
    }

    // Streamlabs advises about 2 alerts a minute for one creator.
    if (conn.last_sent_at && now.getTime() - conn.last_sent_at.getTime() < MIN_GAP_MS) {
      await later(row, new Date(conn.last_sent_at.getTime() + MIN_GAP_MS));
      summary.waiting += 1;
      continue;
    }

    const name = alertName(row.fan_name, !!row.anonymous);
    const message = decision === "with_message" ? alertMessage(row.fan_message, parseBannedWords(row.banned_words)) : null;
    const delivery = await deliver(db, row.creator_id, conn, buildAlert(name, Number(row.gross), message), deps);

    if (delivery.kind === "sent") {
      const sentAt = deps.now();
      await db`
        update streamlabs_outbox set state = 'sent', sent_at = ${sentAt.toISOString()}::timestamptz, attempts = ${row.attempts + 1}::int
         where tip_order_id = ${row.tip_id}::bigint
      `;
      await db`
        update streamlabs_connections set last_sent_at = ${sentAt.toISOString()}::timestamptz, last_error = null, last_error_at = null
         where creator_id = ${row.creator_id}::bigint
      `;
      summary.sent += 1;
    } else if (delivery.kind === "reconnect") {
      await markReconnect(db, row.creator_id, deps.now());
      await drop(row, "reconnect_needed");
    } else if (delivery.kind === "rejected") {
      await recordError(db, row.creator_id, `Streamlabs refused an alert (status ${delivery.status ?? "unknown"}).`, deps.now());
      await drop(row, "rejected");
    } else if (delivery.kind === "rate") {
      await later(row, new Date(deps.now().getTime() + 60_000));
      summary.waiting += 1;
    } else {
      const attempts = row.attempts + 1;
      if (attempts >= MAX_ATTEMPTS) {
        await recordError(db, row.creator_id, "Streamlabs could not be reached for an alert.", deps.now());
        await drop(row, "failed", attempts);
      } else {
        await later(row, new Date(deps.now().getTime() + retryDelayMs(attempts)), attempts);
        summary.retried += 1;
      }
    }
  }
  return summary;
}

export type TestResult = { status: "sent" } | { status: "not_connected" | "reconnect_needed" | "wait" | "failed" };

// The dashboard's "Send a test alert": goes straight out, held to the same spacing.
export async function sendStreamlabsTest(db: LedgerDb, creatorId: number, deps: StreamlabsDeps): Promise<TestResult> {
  const id = String(creatorId);
  const [conn] = await db<Conn[]>`
    select access_token_enc, refresh_token_enc, expires_at, reconnect_needed, last_sent_at
      from streamlabs_connections where creator_id = ${id}::bigint
  `;
  if (!conn) return { status: "not_connected" };
  if (conn.reconnect_needed) return { status: "reconnect_needed" };
  const now = deps.now();
  if (conn.last_sent_at && now.getTime() - conn.last_sent_at.getTime() < MIN_GAP_MS) return { status: "wait" };

  const delivery = await deliver(db, id, conn, TEST_ALERT, deps);
  if (delivery.kind === "sent") {
    await db`
      update streamlabs_connections set last_sent_at = ${deps.now().toISOString()}::timestamptz, last_error = null, last_error_at = null
       where creator_id = ${id}::bigint
    `;
    return { status: "sent" };
  }
  if (delivery.kind === "reconnect") {
    await markReconnect(db, id, deps.now());
    return { status: "reconnect_needed" };
  }
  if (delivery.kind === "rate") return { status: "wait" };
  return { status: "failed" };
}

// A creator connected (or reconnected): keep the tokens sealed and clear any old problem.
export async function saveStreamlabsConnection(
  db: LedgerDb,
  creatorId: number,
  tokens: Tokens,
  displayName: string | null,
): Promise<void> {
  await db`
    insert into streamlabs_connections (creator_id, access_token_enc, refresh_token_enc, expires_at, display_name)
    values (${creatorId}::bigint, ${seal(tokens.accessToken)}::text, ${tokens.refreshToken ? seal(tokens.refreshToken) : null}::text,
            ${iso(tokens.expiresAt)}::timestamptz, ${displayName}::text)
    on conflict (creator_id) do update set
      access_token_enc  = excluded.access_token_enc,
      refresh_token_enc = excluded.refresh_token_enc,
      expires_at        = excluded.expires_at,
      display_name      = excluded.display_name,
      connected_at      = now(),
      reconnect_needed  = false,
      last_error        = null,
      last_error_at     = null
  `;
}

// Disconnecting deletes the tokens at once; anything still queued is dropped, not sent.
export async function disconnectStreamlabs(db: LedgerDb, creatorId: number): Promise<void> {
  await db`
    update streamlabs_outbox set state = 'dropped', reason = 'disconnected'
     where creator_id = ${creatorId}::bigint and state = 'queued'
  `;
  await db`delete from streamlabs_connections where creator_id = ${creatorId}::bigint`;
}

// Closing an account: the connection and the queue rows go (they hold no fan text).
export async function eraseStreamlabs(db: LedgerDb, creatorId: number): Promise<void> {
  await db`delete from streamlabs_outbox where creator_id = ${creatorId}::bigint`;
  await db`delete from streamlabs_connections where creator_id = ${creatorId}::bigint`;
}

export interface StreamlabsState {
  connected: boolean;
  displayName: string | null;
  reconnectNeeded: boolean;
  lastError: string | null;
  lastSentAt: Date | null;
  sent24h: number;
  dropped24h: number;
}

export async function loadStreamlabsState(db: LedgerDb, creatorId: number): Promise<StreamlabsState> {
  const [conn] = await db<
    { display_name: string | null; reconnect_needed: boolean; last_error: string | null; last_sent_at: Date | null }[]
  >`
    select display_name, reconnect_needed, last_error, last_sent_at
      from streamlabs_connections where creator_id = ${creatorId}::bigint
  `;
  const [counts] = await db<{ sent: number; dropped: number }[]>`
    select count(*) filter (where state = 'sent')::int as sent,
           count(*) filter (where state = 'dropped')::int as dropped
      from streamlabs_outbox
     where creator_id = ${creatorId}::bigint and created_at > now() - interval '24 hours'
  `;
  return {
    connected: !!conn,
    displayName: conn?.display_name ?? null,
    reconnectNeeded: conn?.reconnect_needed ?? false,
    lastError: conn?.last_error ?? null,
    lastSentAt: conn?.last_sent_at ?? null,
    sent24h: counts?.sent ?? 0,
    dropped24h: counts?.dropped ?? 0,
  };
}
