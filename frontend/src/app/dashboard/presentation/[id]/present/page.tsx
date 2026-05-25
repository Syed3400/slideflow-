"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Mic,
  MicOff,
  X,
  Loader2,
  Volume2,
  Zap,
  AlertTriangle,
} from "lucide-react";
import { usePresentationEvents } from "@/hooks/usePresentationEvents";
import { presentationStatuses, isPresentationStatus, type PresentationStatus } from "@/lib/types/presentation-status";

interface Slide {
  id: string;
  order: number;
  content: string;
  aiSummary: string;
}

interface Presentation {
  id: string;
  ownerId: string;
  status: PresentationStatus;
  title: string;
  slides: Slide[];
}

function extractKeywords(text: string): string[] {
  const stopWords = new Set([
    "the","a","an","and","or","but","in","on","at","to","for","of","with",
    "by","from","that","this","it","is","was","are","were","be","been",
    "have","has","had","do","does","did","will","would","can","could",
    "should","may","might","shall","not","also","as","so","if","then",
  ]);
  return text
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !stopWords.has(w))
    .slice(0, 15);
}

function scoreMatch(transcript: string, slideContent: string): number {
  const keywords = extractKeywords(slideContent);
  if (keywords.length === 0) return 0;
  const transcriptLower = transcript.toLowerCase();
  const matches = keywords.filter((kw) => transcriptLower.includes(kw));
  return matches.length / Math.min(keywords.length, 5);
}

export default function PresentPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [presentation, setPresentation] = useState<Presentation | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [autoAdvanceEnabled, setAutoAdvanceEnabled] = useState(true);
  const [advanceScore, setAdvanceScore] = useState(0);
  const [justAdvanced, setJustAdvanced] = useState(false);
  const [liveStatus, setLiveStatus] = useState<PresentationStatus>(presentationStatuses.processing);
  const [liveError, setLiveError] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const transcriptRef = useRef("");

  const { isConnected: isSocketConnected, lastEvent: socketEvent } = usePresentationEvents({
    presentationId: id,
    ownerId: presentation?.ownerId,
    enabled: Boolean(id),
  });

  // Load presentation
  useEffect(() => {
    fetch(`/api/presentations/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setPresentation(data);
        if (isPresentationStatus(data.status)) {
          setLiveStatus(data.status);
        } else {
          setLiveStatus(presentationStatuses.processing);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!socketEvent) {
      return;
    }
    const eventStatus = socketEvent.data?.status;
    if (isPresentationStatus(eventStatus)) {
      setLiveStatus(eventStatus);
    }
    if (socketEvent.event === "presentation.failed") {
      const message =
        typeof socketEvent.data?.message === "string"
          ? socketEvent.data.message
          : "Presentation processing failed.";
      setLiveError(message);
    }
  }, [socketEvent]);

  const currentSlide = presentation?.slides[currentIndex];
  const totalSlides = presentation?.slides.length ?? 0;

  const goNext = useCallback(() => {
    setCurrentIndex((i) => Math.min(i + 1, totalSlides - 1));
    setTranscript("");
    transcriptRef.current = "";
    setAdvanceScore(0);
    setJustAdvanced(true);
    setTimeout(() => setJustAdvanced(false), 1500);
  }, [totalSlides]);

  const goPrev = useCallback(() => {
    setCurrentIndex((i) => Math.max(i - 1, 0));
    setTranscript("");
    transcriptRef.current = "";
    setAdvanceScore(0);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") goNext();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "Escape") router.back();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goNext, goPrev, router]);

  // Auto-advance scoring
  useEffect(() => {
    if (!autoAdvanceEnabled || !presentation) return;
    const nextSlide = presentation.slides[currentIndex + 1];
    if (!nextSlide) return;

    const score = scoreMatch(transcript, nextSlide.content);
    setAdvanceScore(score);

    if (score >= 0.6) {
      setTimeout(() => goNext(), 600);
    }
  }, [transcript, currentIndex, presentation, autoAdvanceEnabled, goNext]);

  const startListening = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert(
        "Web Speech API is not supported in this browser. Please use Google Chrome."
      );
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: any) => {
      let interim = "";
      let final = transcriptRef.current;

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          final += " " + result[0].transcript;
        } else {
          interim = result[0].transcript;
        }
      }

      transcriptRef.current = final.trim();
      setTranscript(final.trim());
      setInterimTranscript(interim);
    };

    recognition.onerror = (e: any) => {
      console.error("Speech recognition error:", e.error);
      if (e.error !== "no-speech") {
        setListening(false);
      }
    };

    recognition.onend = () => {
      // Auto-restart if still supposed to be listening
      if (recognitionRef.current) {
        recognition.start();
      }
    };

    recognition.start();
    recognitionRef.current = recognition;
    setListening(true);
  };

  const stopListening = () => {
    const r = recognitionRef.current;
    recognitionRef.current = null;
    r?.stop();
    setListening(false);
    setInterimTranscript("");
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-neutral-950">
        <Loader2 className="h-8 w-8 text-blue-400 animate-spin" />
      </div>
    );
  }

  if (!presentation) {
    return (
      <div className="h-screen flex items-center justify-center bg-neutral-950 text-white">
        <p>Presentation not found.</p>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-neutral-950 text-white select-none">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 bg-neutral-900 border-b border-neutral-800">
        <div className="flex items-center gap-3">
          <button
            onClick={() => { stopListening(); router.back(); }}
            className="p-1.5 hover:bg-neutral-700 rounded-lg transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
          <span className="font-semibold text-sm truncate max-w-sm">
            {presentation.title}
          </span>
        </div>

        <div className="flex items-center gap-2 text-sm text-neutral-400">
          <span className="font-mono">
            {currentIndex + 1} / {totalSlides}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Auto-advance toggle */}
          <button
            onClick={() => setAutoAdvanceEnabled((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              autoAdvanceEnabled
                ? "bg-blue-600/20 text-blue-400 border border-blue-600/30"
                : "bg-neutral-800 text-neutral-400 border border-neutral-700"
            }`}
          >
            <Zap className="h-3.5 w-3.5" />
            Auto-Advance {autoAdvanceEnabled ? "ON" : "OFF"}
          </button>

          {/* Mic button */}
          <button
            onClick={listening ? stopListening : startListening}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              listening
                ? "bg-red-600 text-white animate-pulse"
                : "bg-neutral-700 hover:bg-neutral-600 text-white"
            }`}
          >
            {listening ? (
              <><MicOff className="h-3.5 w-3.5" /> Stop</>
            ) : (
              <><Mic className="h-3.5 w-3.5" /> Start STT</>
            )}
          </button>
        </div>
      </div>

      {(liveStatus !== presentationStatuses.parsed || !isSocketConnected || liveError) && (
        <div className="px-6 py-2 border-b border-neutral-800 bg-neutral-900/80 text-xs text-neutral-300 flex items-center gap-3">
          {liveError ? (
            <>
              <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
              <span className="text-red-300">{liveError}</span>
            </>
          ) : (
            <>
              <span className="inline-flex w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <span>Live status: {liveStatus}</span>
              {!isSocketConnected && <span className="text-neutral-500">(reconnecting)</span>}
            </>
          )}
        </div>
      )}

      {/* Main slide area */}
      <div className="flex-1 flex">
        {/* Slide content */}
        <div className="flex-1 flex flex-col items-center justify-center p-12 relative">
          {justAdvanced && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-sm px-4 py-2 rounded-full animate-bounce z-10">
              ⚡ Auto-advanced!
            </div>
          )}

          <div className="w-full max-w-4xl aspect-video bg-neutral-900 border border-neutral-800 rounded-2xl flex flex-col items-center justify-center p-12 shadow-2xl">
            <div className="text-center space-y-6 max-w-2xl">
              <div className="text-blue-400 text-sm font-mono">
                SLIDE {currentIndex + 1}
              </div>
              {currentSlide?.aiSummary ? (
                <p className="text-2xl font-semibold leading-relaxed text-white">
                  {currentSlide.aiSummary}
                </p>
              ) : (
                <p className="text-lg text-neutral-400 leading-relaxed">
                  {currentSlide?.content || "Empty slide"}
                </p>
              )}
            </div>
          </div>

          {/* Navigation */}
          <div className="flex items-center gap-6 mt-8">
            <button
              onClick={goPrev}
              disabled={currentIndex === 0}
              className="p-3 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-30 disabled:cursor-not-allowed rounded-xl transition-colors"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>

            {/* Progress dots */}
            <div className="flex gap-2">
              {presentation.slides.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentIndex(i)}
                  className={`w-2 h-2 rounded-full transition-all ${
                    i === currentIndex
                      ? "bg-blue-500 w-6"
                      : "bg-neutral-600 hover:bg-neutral-500"
                  }`}
                />
              ))}
            </div>

            <button
              onClick={goNext}
              disabled={currentIndex === totalSlides - 1}
              className="p-3 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-30 disabled:cursor-not-allowed rounded-xl transition-colors"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Right panel: transcript + next slide preview */}
        <div className="w-80 border-l border-neutral-800 flex flex-col">
          {/* Auto-advance score */}
          {autoAdvanceEnabled && currentIndex < totalSlides - 1 && (
            <div className="p-4 border-b border-neutral-800">
              <div className="flex items-center justify-between text-xs text-neutral-400 mb-2">
                <span className="flex items-center gap-1">
                  <Zap className="h-3 w-3" /> Next slide match
                </span>
                <span className="font-mono text-blue-400">
                  {Math.round(advanceScore * 100)}%
                </span>
              </div>
              <div className="h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(advanceScore * 100, 100)}%` }}
                />
              </div>
              <p className="text-xs text-neutral-500 mt-2 truncate">
                Next: {presentation.slides[currentIndex + 1]?.aiSummary?.slice(0, 60)}...
              </p>
            </div>
          )}

          {/* Live transcript */}
          <div className="flex-1 p-4 overflow-y-auto">
            <div className="flex items-center gap-2 mb-3">
              <Volume2 className="h-4 w-4 text-neutral-400" />
              <span className="text-xs font-medium text-neutral-400 uppercase tracking-wider">
                Live Transcript
              </span>
              {listening && (
                <span className="ml-auto flex items-center gap-1 text-xs text-red-400">
                  <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                  Live
                </span>
              )}
            </div>

            {!listening && !transcript && (
              <p className="text-neutral-600 text-sm text-center mt-8">
                Click "Start STT" to begin voice recognition
              </p>
            )}

            {transcript && (
              <p className="text-neutral-300 text-sm leading-relaxed">
                {transcript}
              </p>
            )}

            {interimTranscript && (
              <p className="text-neutral-500 text-sm leading-relaxed italic mt-1">
                {interimTranscript}
              </p>
            )}
          </div>

          {/* Slide notes footer */}
          {currentSlide?.content && (
            <div className="p-4 border-t border-neutral-800 max-h-32 overflow-y-auto">
              <p className="text-xs text-neutral-500 mb-1 uppercase tracking-wider">
                Slide text
              </p>
              <p className="text-xs text-neutral-400 leading-relaxed line-clamp-4">
                {currentSlide.content}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
