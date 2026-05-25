"use client";

import { useRef, useState } from "react";
import { Upload, Loader2, CheckCircle, AlertCircle } from "lucide-react";

async function uploadToProxy(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch("/api/upload-proxy", {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `Upload failed with status ${res.status}`);
  }
  return res.json();
}

export function UploadZone() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "done" | "error">("idle");

  const handleFile = async (file: File) => {
    setStatus("uploading");
    try {
      const result = await uploadToProxy(file);
      console.log("[UploadZone] Created presentation:", result.id);
      setStatus("done");
      setTimeout(() => window.location.reload(), 800);
    } catch (err: any) {
      console.error("[UploadZone] Error:", err);
      setStatus("error");
      setTimeout(() => setStatus("idle"), 3000);
    }
  };

  const label = {
    idle: "Upload Presentation",
    uploading: "Uploading...",
    done: "Done! Refreshing...",
    error: "Upload failed — retry",
  }[status];

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".pptx,.pdf,.docx"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />
      <button
        onClick={() => status === "idle" && inputRef.current?.click()}
        disabled={status === "uploading" || status === "done"}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all h-10 ${
          status === "done"
            ? "bg-green-600 text-white"
            : status === "error"
            ? "bg-red-600 hover:bg-red-700 text-white"
            : "bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white"
        }`}
      >
        {status === "uploading" && <Loader2 className="h-4 w-4 animate-spin" />}
        {status === "done" && <CheckCircle className="h-4 w-4" />}
        {status === "error" && <AlertCircle className="h-4 w-4" />}
        {status === "idle" && <Upload className="h-4 w-4" />}
        {label}
      </button>
    </>
  );
}

export function UploadZoneLarge() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [dragging, setDragging] = useState(false);

  const handleFile = async (file: File) => {
    setStatus("uploading");
    try {
      const result = await uploadToProxy(file);
      console.log("[UploadZoneLarge] Created presentation:", result.id);
      setStatus("done");
      setTimeout(() => window.location.reload(), 800);
    } catch (err: any) {
      console.error("[UploadZoneLarge] Error:", err);
      setStatus("error");
      setTimeout(() => setStatus("idle"), 3000);
    }
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) handleFile(file);
      }}
      onClick={() => status === "idle" && inputRef.current?.click()}
      className={`cursor-pointer w-full max-w-sm border-2 border-dashed rounded-xl p-8 flex flex-col items-center gap-3 transition-colors ${
        dragging
          ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
          : status === "done"
          ? "border-green-500 bg-green-50 dark:bg-green-900/20"
          : status === "error"
          ? "border-red-400"
          : "border-neutral-300 dark:border-neutral-700 hover:border-blue-400"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pptx,.pdf,.docx"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />
      {status === "uploading" && <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />}
      {status === "done" && <CheckCircle className="h-8 w-8 text-green-600" />}
      {status === "error" && <AlertCircle className="h-8 w-8 text-red-500" />}
      {status === "idle" && <Upload className="h-8 w-8 text-blue-600" />}
      <p className="text-sm font-medium text-center">
        {status === "idle" && "Drop your file here or click to browse"}
        {status === "uploading" && "Uploading your presentation..."}
        {status === "done" && "Upload complete! Refreshing dashboard..."}
        {status === "error" && "Upload failed. Is FastAPI running on :8000?"}
      </p>
      <p className="text-xs text-neutral-500">Supports .pptx, .pdf, .docx — up to 32MB</p>
    </div>
  );
}