"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveBirthdayMessage } from "@/app/actions/fans";
import { BIRTHDAY_TEMPLATE_MAX, renderBirthdayMessage } from "@/lib/birthday";
import { Msg } from "../parts/Msg";
import { field, pillPrimary } from "../parts/styles";

// The creator's greeting. {name} becomes the fan's name. Empty turns the message off, and
// the tip page then stops asking for a birthday.
export function BirthdayForm({ initial }: { initial: string }) {
  const router = useRouter();
  const [text, setText] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "error" | "ok"; text: string } | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const res = await saveBirthdayMessage(text);
    setBusy(false);
    if (res.status === "error") {
      setMessage({ kind: "error", text: res.message });
      return;
    }
    setMessage({ kind: "ok", text: text.trim() ? "Saved. Fans are now asked for their birthday." : "Turned off. Fans are no longer asked." });
    router.refresh();
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <label className="block space-y-2">
        <span className="text-sm font-medium text-text">Your greeting</span>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={BIRTHDAY_TEMPLATE_MAX}
          placeholder="Happy birthday, {name}! 🎉"
          className={field}
        />
        <span className="numeric block text-right text-xs text-muted">
          {text.length}/{BIRTHDAY_TEMPLATE_MAX}
        </span>
      </label>
      {text.trim() && (
        <p className="rounded-field border border-line/60 bg-ground px-4 py-3 text-sm text-text">
          <span className="text-muted">On the alert: </span>🎂 {renderBirthdayMessage(text.replace(/\s+/g, " ").trim(), "Riya")}
        </p>
      )}
      <button type="submit" disabled={busy} className={pillPrimary}>
        {busy ? "Saving…" : "Save greeting"}
      </button>
      <Msg kind={message?.kind} text={message?.text} />
    </form>
  );
}
