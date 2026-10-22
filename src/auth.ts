import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { getDb } from "@/lib/db";

// YouTube Data API v3 — fetch the authed user's channel.
async function fetchYouTubeChannel(accessToken: string) {
  try {
    const res = await fetch(
      "https://www.googleapis.com/youtube/v3/channels?part=id,snippet&mine=true",
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      items?: { id: string; snippet: { title: string; customUrl?: string } }[];
    };
    const ch = data.items?.[0];
    if (!ch) return null;
    return {
      yt_channel_id: ch.id,
      yt_channel_name: ch.snippet.title,
      yt_channel_url: ch.snippet.customUrl
        ? `https://youtube.com/${ch.snippet.customUrl}`
        : `https://youtube.com/channel/${ch.id}`,
    };
  } catch {
    return null;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      authorization: {
        params: {
          scope: [
            "openid",
            "email",
            "profile",
            "https://www.googleapis.com/auth/youtube.readonly",
          ].join(" "),
          // Always show account picker so multi-channel creators can switch.
          prompt: "select_account",
        },
      },
    }),
  ],

  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider !== "google" || !user.email) return false;
      if (!(profile as { email_verified?: boolean })?.email_verified) return false;

      const db = getDb();
      // Fail closed in production; allow dev without a database.
      if (!db) return process.env.NODE_ENV !== "production";

      const yt = account.access_token
        ? await fetchYouTubeChannel(account.access_token)
        : null;

      try {
        await db`
          insert into users (google_id, email, name, picture_url,
            yt_channel_id, yt_channel_name, yt_channel_url)
          values (
            ${account.providerAccountId},
            ${user.email},
            ${user.name ?? null},
            ${user.image ?? null},
            ${yt?.yt_channel_id ?? null},
            ${yt?.yt_channel_name ?? null},
            ${yt?.yt_channel_url ?? null}
          )
          on conflict (google_id) do update set
            email           = excluded.email,
            name            = excluded.name,
            picture_url     = excluded.picture_url,
            yt_channel_id   = coalesce(excluded.yt_channel_id,   users.yt_channel_id),
            yt_channel_name = coalesce(excluded.yt_channel_name, users.yt_channel_name),
            yt_channel_url  = coalesce(excluded.yt_channel_url,  users.yt_channel_url)
        `;
      } catch (err: unknown) {
        // Another google_id already owns this email address.
        if (err instanceof Error && err.message.includes("unique")) return false;
        throw err;
      }

      return true;
    },

    // Pass google_id into the JWT so server components can use it without a
    // DB round-trip on every render.
    async jwt({ token, account }) {
      if (account?.providerAccountId) {
        token.googleId = account.providerAccountId;
      }
      return token;
    },

    async session({ session, token }) {
      if (token.googleId) {
        (session.user as typeof session.user & { googleId: string }).googleId =
          token.googleId as string;
      }
      return session;
    },
  },

  pages: {
    signIn: "/signin",
    error: "/signin",
    newUser: "/dashboard",
  },
});
