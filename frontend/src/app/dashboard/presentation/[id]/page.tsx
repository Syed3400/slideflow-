import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Play, FileText, Clock, Loader2 } from "lucide-react";
import { PresentationLiveStatus } from "@/components/PresentationLiveStatus";
import { presentationStatuses } from "@/lib/types/presentation-status";

export default async function PresentationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { userId } = await auth();
  if (!userId) return null;

  const presentation = await prisma.presentation.findFirst({
    where: { id, ownerId: userId },
    include: { slides: { orderBy: { order: "asc" } } },
  });

  if (!presentation) notFound();

  const isProcessing = presentation.status === presentationStatuses.processing;

  return (
    <div className="max-w-5xl mx-auto space-y-8 p-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard"
          className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">{presentation.title}</h1>
          <div className="flex items-center gap-2 mt-1 text-sm text-neutral-500">
            <Clock className="h-4 w-4" />
            {new Date(presentation.createdAt).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </div>
        </div>

        {/* Status badge */}
        <PresentationLiveStatus
          presentationId={presentation.id}
          ownerId={presentation.ownerId}
          initialStatus={presentation.status}
        />

        {/* Start button */}
        {!isProcessing && presentation.slides.length > 0 && (
          <Link
            href={`/dashboard/presentation/${presentation.id}/present`}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-medium transition-colors"
          >
            <Play className="h-4 w-4 fill-white" />
            Start Presenting
          </Link>
        )}
      </div>

      {/* Processing state */}
      {isProcessing && (
        <div className="border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10 rounded-xl p-8 text-center">
          <Loader2 className="h-10 w-10 text-amber-500 animate-spin mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">AI is analyzing your presentation</h3>
          <p className="text-neutral-500 dark:text-neutral-400 max-w-sm mx-auto">
            Our AI is extracting text, generating summaries, and identifying keywords for each slide. This usually takes 30–60 seconds.
          </p>
          <p className="text-sm text-neutral-400 mt-4">Live status updates are enabled.</p>
        </div>
      )}

      {/* Slides grid */}
      {!isProcessing && presentation.slides.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">
            {presentation.slides.length} Slides
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {presentation.slides.map((slide) => (
              <div
                key={slide.id}
                className="border border-neutral-200 dark:border-neutral-800 rounded-xl p-5 bg-white dark:bg-neutral-900 space-y-3"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold bg-blue-600 text-white w-7 h-7 rounded-full flex items-center justify-center">
                    {slide.order}
                  </span>
                  <span className="text-sm font-medium text-neutral-500">Slide {slide.order}</span>
                </div>
                {slide.aiSummary && (
                  <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed">
                    {slide.aiSummary}
                  </p>
                )}
                {slide.content && (
                  <p className="text-xs text-neutral-400 line-clamp-2">
                    {slide.content}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state after processing */}
      {!isProcessing && presentation.slides.length === 0 && (
        <div className="border-2 border-dashed border-neutral-200 dark:border-neutral-800 rounded-xl p-12 text-center">
          <FileText className="h-10 w-10 text-neutral-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No slides found</h3>
          <p className="text-neutral-500 text-sm">
            The file may not have been parseable. Try uploading a valid .pptx file.
          </p>
        </div>
      )}
    </div>
  );
}
