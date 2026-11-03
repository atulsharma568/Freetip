import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppBackdrop } from "@/components/AppBackdrop";

// The sign-in check lives here, above the loading screen. A redirect inside a page
// that has a loading.tsx arrives after the response has started streaming, so
// signed-out visitors would get a 200 page that redirects in the browser. Here it is
// a real 307 before anything is sent. The pages keep their own check as a backstop.
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/signin");
  return (
    <>
      <AppBackdrop />
      {children}
    </>
  );
}
