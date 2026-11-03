// The few YouTube and Google calls the timestamps feature needs, behind a small
// interface so the posting logic can be tested with a fake. Plain fetch, short
// timeouts. Nothing here is retried after a request that may have gone through:
// a retried comment could be posted twice.

const API = "https://www.googleapis.com/youtube/v3";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const TIMEOUT_MS = 12_000;

export type YtVideo = {
  id: string;
  channelId: string;
  title: string;
  startedAt: string | null;
  endedAt: string | null;
  isLive: boolean;
  // False when the video is private (a private stream cannot be commented on).
  visible: boolean;
  madeForKids: boolean;
};

export type RefreshResult = { ok: true; accessToken: string } | { ok: false; reason: "invalid_grant" | "failed" };

export type PostResult =
  | { outcome: "posted"; commentId: string }
  // Not worth retrying: comments are off, members only, made for kids, and the like.
  | { outcome: "rejected"; reason: string }
  // Daily quota used up: leave it for the next run.
  | { outcome: "quota" }
  // The request may or may not have posted (timeout, 5xx). Not retried automatically.
  | { outcome: "unknown" }
  | { outcome: "failed"; reason: string };

export interface YouTubeClient {
  getVideos(ids: string[]): Promise<Map<string, YtVideo> | null>;
  refreshAccessToken(refreshToken: string): Promise<RefreshResult>;
  postComment(accessToken: string, videoId: string, text: string): Promise<PostResult>;
  // The creator's video that is live right now, or null.
  activeBroadcast(accessToken: string): Promise<string | null>;
  revoke(token: string): Promise<void>;
}

type VideoItem = {
  id: string;
  snippet?: { channelId?: string; title?: string; liveBroadcastContent?: string };
  status?: { privacyStatus?: string; madeForKids?: boolean };
  liveStreamingDetails?: { actualStartTime?: string; actualEndTime?: string };
};

export function toVideo(item: VideoItem): YtVideo {
  return {
    id: item.id,
    channelId: item.snippet?.channelId ?? "",
    title: item.snippet?.title ?? "",
    startedAt: item.liveStreamingDetails?.actualStartTime ?? null,
    endedAt: item.liveStreamingDetails?.actualEndTime ?? null,
    isLive: item.snippet?.liveBroadcastContent === "live",
    visible: item.status?.privacyStatus !== "private",
    madeForKids: item.status?.madeForKids === true,
  };
}

export function youtubeConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.YT_DATA_API_KEY && env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET);
}

export function createYouTubeClient(env: NodeJS.ProcessEnv = process.env, doFetch: typeof fetch = fetch): YouTubeClient {
  const signal = () => AbortSignal.timeout(TIMEOUT_MS);

  return {
    async getVideos(ids) {
      if (!ids.length || !env.YT_DATA_API_KEY) return new Map();
      try {
        const url = new URL(`${API}/videos`);
        url.searchParams.set("part", "snippet,status,liveStreamingDetails");
        url.searchParams.set("id", ids.slice(0, 50).join(","));
        url.searchParams.set("key", env.YT_DATA_API_KEY);
        const res = await doFetch(url, { signal: signal() });
        if (!res.ok) {
          console.error(`YouTube: videos.list answered ${res.status}.`);
          return null;
        }
        const json = (await res.json()) as { items?: VideoItem[] };
        return new Map((json.items ?? []).map((i) => [i.id, toVideo(i)]));
      } catch (err) {
        console.error("YouTube: videos.list failed.", err);
        return null;
      }
    },

    async refreshAccessToken(refreshToken) {
      try {
        const res = await doFetch(TOKEN_URL, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: env.AUTH_GOOGLE_ID ?? "",
            client_secret: env.AUTH_GOOGLE_SECRET ?? "",
            refresh_token: refreshToken,
            grant_type: "refresh_token",
          }),
          signal: signal(),
        });
        const json = (await res.json().catch(() => ({}))) as { access_token?: string; error?: string };
        if (res.ok && json.access_token) return { ok: true, accessToken: json.access_token };
        console.error(`YouTube: token refresh answered ${res.status} (${json.error ?? "no reason"}).`);
        return { ok: false, reason: json.error === "invalid_grant" ? "invalid_grant" : "failed" };
      } catch (err) {
        console.error("YouTube: token refresh failed.", err);
        return { ok: false, reason: "failed" };
      }
    },

    async postComment(accessToken, videoId, text) {
      let res: Response;
      try {
        res = await doFetch(`${API}/commentThreads?part=snippet`, {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            snippet: { videoId, topLevelComment: { snippet: { textOriginal: text } } },
          }),
          signal: signal(),
        });
      } catch {
        // Timed out or dropped: YouTube may have taken it.
        return { outcome: "unknown" };
      }
      if (res.ok) {
        const json = (await res.json().catch(() => ({}))) as { id?: string };
        return { outcome: "posted", commentId: json.id ?? "" };
      }
      if (res.status >= 500) return { outcome: "unknown" };
      const body = (await res.text().catch(() => "")).toLowerCase();
      if (body.includes("quotaexceeded") || body.includes("dailylimitexceeded")) return { outcome: "quota" };
      if (body.includes("commentsdisabled")) return { outcome: "rejected", reason: "not_commentable" };
      if (body.includes("channelsubscriptionrequired") || body.includes("forbidden") || body.includes("insufficientpermissions")) {
        return { outcome: "rejected", reason: "not_allowed" };
      }
      console.error(`YouTube: commentThreads.insert answered ${res.status}.`);
      return { outcome: "failed", reason: `http_${res.status}` };
    },

    async activeBroadcast(accessToken) {
      try {
        const url = new URL(`${API}/liveBroadcasts`);
        url.searchParams.set("part", "id");
        url.searchParams.set("mine", "true");
        url.searchParams.set("broadcastStatus", "active");
        const res = await doFetch(url, { headers: { Authorization: `Bearer ${accessToken}` }, signal: signal() });
        if (!res.ok) {
          const body = (await res.text().catch(() => "")).slice(0, 300);
          console.error(`YouTube: liveBroadcasts.list answered ${res.status}. ${body}`);
          return null;
        }
        const json = (await res.json()) as { items?: { id?: string }[] };
        const id = json.items?.[0]?.id ?? null;
        if (!id) console.error("YouTube: liveBroadcasts.list found no active broadcast (is the stream fully live, not in preview?).");
        return id;
      } catch (err) {
        console.error("YouTube: liveBroadcasts.list failed.", err);
        return null;
      }
    },

    async revoke(token) {
      try {
        await doFetch(REVOKE_URL, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ token }),
          signal: signal(),
        });
      } catch {
        // Best effort: the token is deleted on our side either way.
      }
    },
  };
}
