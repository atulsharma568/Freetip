// Initial form states for the creator actions. They live here, not in
// `src/app/actions/creator.ts`, because a "use server" file may only export async functions.
import type {
  CloseAccountState,
  HandleState,
  PayoutState,
  SettingsState,
} from "@/app/actions/creator";

export const HANDLE_IDLE: HandleState = { status: "idle" };
export const PAYOUT_IDLE: PayoutState = { status: "idle" };
export const SETTINGS_IDLE: SettingsState = { status: "idle" };
export const CLOSE_ACCOUNT_IDLE: CloseAccountState = { status: "idle" };
