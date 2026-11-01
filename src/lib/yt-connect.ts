import { SITE_URL } from "./url";

// Shared by the two halves of "Connect YouTube for timestamps". Kept out of the route
// files because a Next route file may only export its handlers.
export const YT_STATE_COOKIE = "yt_connect_state";
export const YT_COMMENT_SCOPE = "https://www.googleapis.com/auth/youtube.force-ssl";
export const ytRedirectUri = () => `${SITE_URL}/api/yt-connect/callback`;
