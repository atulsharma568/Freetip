import { redirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { PageShell } from "@/components/PageShell";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: `Dashboard: ${SITE_NAME}`,
  robots: { index: false },
};

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/signin");

  const name = session.user.name?.split(" ")[0] ?? "Creator";

  return (
    <PageShell>
      <div className="flex flex-1 items-center justify-center px-6 py-16">
        <div className="w-full max-w-md space-y-8 text-center">
          {session.user.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={session.user.image}
              alt=""
              width={64}
              height={64}
              className="mx-auto rounded-full"
            />
          )}

          <div className="space-y-3">
            <h1 className="display text-[clamp(2rem,8vw,3rem)]">
              You&apos;re in, {name}.
            </h1>
            <p className="text-pretty text-lg text-muted">
              Early access is reserved. We&apos;re building the tip page and
              creator tools now — we&apos;ll email you when your link is ready.
            </p>
          </div>

          <div className="rounded-2xl border border-control bg-surface px-6 py-5 text-left space-y-3">
            <p className="text-sm font-medium text-muted uppercase tracking-widest">
              What&apos;s coming
            </p>
            <ul className="space-y-2 text-base text-text">
              {[
                "Your tipsite.in/handle link",
                "UPI and card tips from fans",
                "OBS alerts with fan messages",
                "Text-to-speech (approve before play)",
                "No fan account or email needed",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-accent" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <p className="text-sm text-muted">
            Questions?{" "}
            <Link
              href="/contact"
              className="text-text underline decoration-line hover:decoration-accent"
            >
              Contact us
            </Link>
          </p>
        </div>
      </div>
    </PageShell>
  );
}
