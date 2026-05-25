import { describe, expect, it } from "vitest";
import { isPresentationStatus, presentationStatuses } from "./presentation-status";

describe("presentation status contract", () => {
  it("accepts canonical status values", () => {
    expect(isPresentationStatus(presentationStatuses.pending)).toBe(true);
    expect(isPresentationStatus(presentationStatuses.processing)).toBe(true);
    expect(isPresentationStatus(presentationStatuses.parsed)).toBe(true);
    expect(isPresentationStatus(presentationStatuses.error)).toBe(true);
  });

  it("rejects non-canonical values", () => {
    expect(isPresentationStatus("processing")).toBe(false);
    expect(isPresentationStatus("DONE")).toBe(false);
    expect(isPresentationStatus(null)).toBe(false);
  });
});
