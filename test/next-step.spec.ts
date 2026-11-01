import { test, expect } from "@playwright/test";
import { nextStep, type NextStepInput } from "../src/lib/next-step";

const done: NextStepInput = {
  creatorStatus: "active",
  onboardingState: "active",
  hasOverlayLink: true,
  tipCount: 3,
};

test("a finished creator has no next step", () => {
  expect(nextStep(done)).toBeNull();
});

test("a suspended creator gets no card", () => {
  expect(nextStep({ ...done, creatorStatus: "suspended", hasOverlayLink: false })).toBeNull();
});

test("pending creators are sent to payout details first", () => {
  const base = { ...done, creatorStatus: "pending" as const, hasOverlayLink: false, tipCount: 0 };
  expect(nextStep({ ...base, onboardingState: "not_started" })?.href).toBe("#payout");
  expect(nextStep({ ...base, onboardingState: "rejected" })?.title).toMatch(/Fix/);
  expect(nextStep({ ...base, onboardingState: "submitted" })?.href).toBe("#alerts");
});

test("active without an overlay link goes to alerts, then to sharing", () => {
  expect(nextStep({ ...done, hasOverlayLink: false, tipCount: 0 })?.href).toBe("#alerts");
  expect(nextStep({ ...done, tipCount: 0 })?.href).toBe("#tip-page");
});
