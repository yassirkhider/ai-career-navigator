"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CvUploadWidget() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function handleUpload() {
    if (!file) return;
    setStatus("uploading");
    setMessage(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/cv/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        setStatus("error");
        setMessage(data.error || "Upload failed.");
        return;
      }
      setStatus("done");
      setMessage("CV uploaded and parsed into your Master Career Profile.");
      router.refresh();
    } catch {
      setStatus("error");
      setMessage("Network error during upload.");
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <h2 className="font-semibold text-slate-900">Upload your CV</h2>
      <p className="mt-1 text-sm text-slate-500">PDF, DOCX, or TXT — up to 10MB.</p>
      <div className="mt-4 flex items-center gap-3">
        <input
          type="file"
          accept=".pdf,.docx,.txt"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="text-sm"
        />
        <button
          onClick={handleUpload}
          disabled={!file || status === "uploading"}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {status === "uploading" ? "Uploading…" : "Upload & Parse"}
        </button>
      </div>
      {message && (
        <p
          className={`mt-3 text-sm ${status === "error" ? "text-red-600" : "text-green-700"}`}
        >
          {message}
        </p>
      )}
    </div>
  );
}
