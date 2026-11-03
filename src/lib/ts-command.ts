import { SITE_URL } from "@/lib/url";

// The command to paste into Nightbot (or a bot like it) for one secret address.
export const nightbotCommand = (token: string) =>
  `!addcom !ts $(urlfetch ${SITE_URL}/api/ts/${token}?user=$(user)&chatId=$(chatid)&msg=$(querystring))`;
