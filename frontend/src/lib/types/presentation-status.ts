export const presentationStatuses = {
  pending: "PENDING",
  processing: "PROCESSING",
  parsed: "PARSED",
  error: "ERROR",
} as const;

export type PresentationStatus = (typeof presentationStatuses)[keyof typeof presentationStatuses];

export function isPresentationStatus(value: unknown): value is PresentationStatus {
  return typeof value === "string" && Object.values(presentationStatuses).includes(value as PresentationStatus);
}
