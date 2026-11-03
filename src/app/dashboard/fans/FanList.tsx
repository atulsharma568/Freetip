"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteFanProfile, saveFanNote } from "@/app/actions/fans";
import { FAN_NOTE_MAX } from "@/lib/fan-profiles";
import { Msg } from "../parts/Msg";
import { ConfirmAction } from "../parts/ConfirmAction";
import { field, pillOutline } from "../parts/styles";

export interface FanItem {
  key: string;
  name: string;
  level: number | null;
  tips: number;
  total: string;
  latest: string;
  note: string;
}

export function FanList({ fans }: { fans: FanItem[] }) {
  return (
    <ul className="space-y-3">
      {fans.map((f) => (
        <Fan key={f.key} fan={f} />
      ))}
    </ul>
  );
}

function Fan({ fan }: { fan: FanItem }) {
  const router = useRouter();
  const [note, setNote] = useState(fan.note);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "error" | "ok"; text: string } | null>(null);

  async function save() {
    setBusy(true);
    setMessage(null);
    const res = await saveFanNote(fan.key, note);
    setBusy(false);
    setMessage(res.status === "error" ? { kind: "error", text: res.message } : { kind: "ok", text: "Note saved." });
    if (res.status === "ok") router.refresh();
  }

  async function remove() {
    setBusy(true);
    const res = await deleteFanProfile(fan.key);
    setBusy(false);
    if (res.status === "error") setMessage({ kind: "error", text: res.message });
    else router.refresh();
  }

  return (
    <li className="space-y-3 rounded-[var(--radius-surface)] border border-line/60 bg-surface p-5">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p className="min-w-0 break-words text-base font-semibold text-text">{fan.name}</p>
        {fan.level !== null && <span className="numeric rounded-full border border-control px-2.5 py-0.5 text-xs text-text">Lv {fan.level}</span>}
        <p className="numeric ml-auto text-base text-text">{fan.total}</p>
      </div>
      <p className="numeric text-xs text-muted">
        {fan.tips} {fan.tips === 1 ? "tip" : "tips"} · latest {fan.latest}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          aria-label={`Private note about ${fan.name}`}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={FAN_NOTE_MAX}
          placeholder="Private note (only you see it)"
          className={`${field} !h-11 min-w-0 flex-1`}
        />
        <button type="button" onClick={save} disabled={busy || note.trim() === fan.note} className={pillOutline}>
          Save note
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <ConfirmAction
          prompt={`Delete ${fan.name}? Their profile, points and level are removed. A new tip with this name starts a new profile.`}
          confirmLabel="Yes, delete this fan"
          keepLabel="Keep them"
          onConfirm={remove}
          disabled={busy}
          className={pillOutline}
        >
          Delete fan
        </ConfirmAction>
      </div>
      <Msg kind={message?.kind} text={message?.text} />
    </li>
  );
}
