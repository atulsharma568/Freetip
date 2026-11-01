// Plain-English reasons an owner action did not go through.

export const HANDLE_BLOCKED: Record<string, string> = {
  taken: "Someone else has that handle now. Reject the request with a note.",
  already_renamed: "This creator has already used their one change.",
  same: "The creator already has that handle.",
  no_handle: "The creator has no handle.",
  closed: "The account is closed.",
  not_found: "The account was not found.",
};
