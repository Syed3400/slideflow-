"use client";

import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { usePresentationEvents } from "@/hooks/usePresentationEvents";
import { presentationStatuses, type PresentationStatus, isPresentationStatus } from "@/lib/types/presentation-status";

type Props = {
  presentationId: string;
  ownerId: string;
  initialStatus: PresentationStatus;
  compact?: boolean;
};

export function PresentationLiveStatus({ presentationId, ownerId, initialStatus, compact = false }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [progress, setProgress] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const shouldConnect = status === presentationStatuses.processing || status === presentationStatuses.pending;

  const { isConnected, lastEvent } = usePresentationEvents({
    presentationId,
    ownerId,
    enabled: shouldConnect,
  });

  useEffect(() => {
    if (!lastEvent) {
      return;
    }

    const eventStatus = lastEvent.data?.status;
    if (isPresentationStatus(eventStatus)) {
      setStatus(eventStatus);
    }

    const eventProgress = lastEvent.data?.progressPercent;
    if (typeof eventProgress === "number") {
      setProgress(eventProgress);
    }

    if (lastEvent.event === "presentation.failed") {
      const message = typeof lastEvent.data?.message === "string" ? lastEvent.data.message : "Processing failed.";
      setErrorMessage(message);
      router.refresh();
      return;
    }

    if (lastEvent.event === "presentation.completed") {
      setProgress(100);
      router.refresh();
    }
  }, [lastEvent, router]);

  if (status === presentationStatuses.error) {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
        <AlertCircle className="h-3.5 w-3.5" />
        {compact ? "ERROR" : errorMessage || "Processing failed"}
      </div>
    );
  }

  if (status === presentationStatuses.parsed) {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300">
        <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
        {compact ? "PARSED" : "Ready"}
      </div>
    );
  }

  const progressLabel = typeof progress === "number" ? ` ${Math.round(progress)}%` : "";

  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300">
      <Loader2 className="h-3.5 w-3.5 animate-spin" />
      {compact ? `PROCESSING${progressLabel}` : `AI Processing${progressLabel}`}
      {!isConnected && <span className="text-[10px] opacity-80">(reconnecting)</span>}
    </div>
  );
}
