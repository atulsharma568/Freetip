// What an owner action tells the page after it runs. Plain data (it crosses from
// the server to the browser). Kept out of the "use server" file because that file
// may only export async functions.

export type AdminActionState =
  | { status: "idle" }
  | { status: "ok"; message: string }
  | { status: "error"; message: string };

export const ADMIN_IDLE: AdminActionState = { status: "idle" };

// A server action bound to its target with `.bind(null, id, ...)`, ready for
// useActionState.
export type AdminAction = (prev: AdminActionState, formData: FormData) => Promise<AdminActionState>;
