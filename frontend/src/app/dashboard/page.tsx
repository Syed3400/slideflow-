import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import Link from "next/link";
import { FileText, Clock } from "lucide-react";
import dynamic from "next/dynamic";
import { UploadZone, UploadZoneLarge } from "@/components/UploadZone";
import { PresentationLiveStatus } from "@/components/PresentationLiveStatus";
import { presentationStatuses } from "@/lib/types/presentation-status";

export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) {
    return null;
  }

  const presentations = await prisma.presentation.findMany({
    where: { ownerId: userId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { slides: true } } },
  });

  return (
    <div className="max-w-6xl mx-auto space-y-8 p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Presentations</h1>
          <p className="text-neutral-500 dark:text-neutral-400 mt-1">
            Manage your presentations and view live analytics.
          </p>
        </div>
        <UploadZone />
      </div>

      {presentations.length === 0 ? (
        <div className="border-2 border-dashed border-neutral-200 dark:border-neutral-800 rounded-xl p-12 text-center flex flex-col items-center justify-center bg-white dark:bg-neutral-900/50">
          <div className="h-12 w-12 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center mb-4">
            <FileText className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          </div>
          <h3 className="text-lg font-semibold mb-1">No presentations yet</h3>
          <p className="text-neutral-500 dark:text-neutral-400 max-w-sm mb-6">
            Upload your first presentation (.pptx, .pdf) to start practicing and presenting with AI.
          </p>
          <UploadZoneLarge />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {presentations.map((pres) => (
            <Link href={`/dashboard/presentation/${pres.id}`} key={pres.id} className="group block">
              <div className="border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden bg-white dark:bg-neutral-900 hover:shadow-lg transition-all hover:border-blue-500/50">
                <div className="aspect-video bg-gradient-to-br from-blue-500/10 via-purple-500/5 to-neutral-100 dark:from-blue-900/20 dark:via-purple-900/10 dark:to-neutral-800 relative flex items-center justify-center">
                  <FileText className="h-12 w-12 text-neutral-300 dark:text-neutral-600" />
                  {/* Status badge */}
                  <div className="absolute top-3 right-3">
                    <PresentationLiveStatus
                      presentationId={pres.id}
                      ownerId={pres.ownerId}
                      initialStatus={pres.status}
                      compact
                    />
                  </div>
                  {/* Hover play button */}
                  {pres.status !== presentationStatuses.processing && (
                    <Link
                      href={`/dashboard/presentation/${pres.id}/present`}
                      onClick={(e) => e.stopPropagation()}
                      className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 backdrop-blur-sm"
                    >
                      <div className="bg-white text-blue-600 rounded-full p-3 shadow-xl">
                        <svg className="h-6 w-6 fill-current" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                      </div>
                    </Link>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-lg line-clamp-1 mb-1 group-hover:text-blue-600 transition-colors">
                    {pres.title}
                  </h3>
                  <div className="flex items-center gap-4 text-xs text-neutral-500 dark:text-neutral-400">
                    <span className="flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5" />
                      {pres._count.slides} Slides
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" />
                      {new Date(pres.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}