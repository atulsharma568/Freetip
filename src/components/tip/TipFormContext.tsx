"use client";

import { createContext, useContext } from "react";
import type { TipRule, TipSound } from "@/app/[handle]/creator";
import type { ResolvedAsset } from "@/lib/page-doc/assets";
import type { MeterReading } from "@/lib/page-doc/pressure";
import type { PinOffer } from "@/lib/pinned";
import type { nextMessageStep } from "@/lib/message-limit";
import type { Extra } from "@/components/tip/ExtraPicker";

export type Phase = "idle" | "creating" | "checkout" | "success" | "error";

// Everything the blocks of the tip page read from the form. `TipForm` owns the state and the
// payment code and fills this in; a block only shows it and calls what it is handed, so no block
// can change what a payment does. The words and limits that matter to a payment come from here,
// never from a page document.
export interface TipFormState {
  // The creator and the page.
  handle: string;
  displayName: string;
  pictureUrl: string | null;
  bannerUrl: string | null;
  // The pictures the page document may use, by id (empty when it uses none).
  assets: Record<number, ResolvedAsset>;
  ytChannelName: string | null;
  ytChannelUrl: string | null;
  bio: string | null;
  previewMode: boolean;
  // True only in the owner's editor preview: blocks then carry `data-block-id` so a click can pick one.
  editing: boolean;
  // The Pressure meter: whether the page may draw one (both switches on, or the owner's editor)
  // and its first reading, null while the creator has no goal.
  meterOn: boolean;
  meter: MeterReading | null;

  // The amount.
  presets: number[];
  minTipPaise: number;
  minRupees: number;
  selected: number | "custom";
  custom: string;
  amountRupees: number;
  amountPaise: number;
  amountLocked: boolean;
  lockWarning: boolean;
  setLockWarning: (on: boolean) => void;
  pickPreset: (preset: number | "custom") => void;
  changeCustom: (raw: string) => void;
  announce: string;

  // The note: name, message, pin and extras.
  anonymous: boolean;
  setAnonymous: (on: boolean) => void;
  tipName: string;
  changeName: (value: string) => void;
  remember: boolean;
  changeRemember: (on: boolean) => void;
  message: string;
  setMessage: (value: string) => void;
  messageMaxChars: number;
  messageLimit: number;
  moreChars: ReturnType<typeof nextMessageStep>;
  messageTooLong: boolean;
  alertName: string;
  rulePicked: boolean;
  pinOffer: PinOffer | null;
  pin: boolean;
  setPin: (on: boolean) => void;
  pinTooPricey: boolean;
  pinNeedsMessage: boolean;
  sounds: TipSound[];
  rules: TipRule[];
  voiceMinPaise: number | null;
  extra: Extra;
  chooseExtra: (next: Extra) => void;
  chosenSound: TipSound | null;
  soundTooPricey: boolean;
  voiceTooPricey: boolean;

  // Sending.
  phase: Phase;
  errorMsg: string;
  closed: boolean;
  extraBlocked: boolean;
  agreed: boolean;
  setAgreed: (on: boolean) => void;
  handlePay: () => Promise<void>;
}

// The attribute that lets the editor preview tell which block was clicked. Nothing on the real page.
export const blockAttrs = (editing: boolean, id: string) => (editing ? { "data-block-id": id } : {});

const TipFormContext = createContext<TipFormState | null>(null);

export const TipFormProvider = TipFormContext.Provider;

export function useTipForm(): TipFormState {
  const state = useContext(TipFormContext);
  if (!state) throw new Error("A tip page block was drawn outside the tip form.");
  return state;
}
