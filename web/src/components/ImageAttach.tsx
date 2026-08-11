"use client";

import { useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { apiUpload, mediaURL } from "@/lib/api";
import type { Attachment } from "@/lib/types";

export function ImageAttach({
  attachments,
  onChange,
  disabled,
}: {
  attachments: Attachment[];
  onChange: (next: Attachment[]) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onPick(files: FileList | null) {
    if (!files?.length || disabled) return;
    setBusy(true);
    setError("");
    try {
      const next = [...attachments];
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) {
          setError("Images only (jpeg, png, gif, webp)");
          continue;
        }
        const uploaded = await apiUpload(file, "attachment");
        next.push({
          id: uploaded.id,
          filename: uploaded.filename,
          url: uploaded.url,
          mimeType: uploaded.mimeType,
          sizeBytes: uploaded.sizeBytes,
          createdAt: new Date().toISOString(),
        });
      }
      onChange(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="btn-ghost !px-3 !py-2 text-xs"
          disabled={disabled || busy}
          onClick={() => inputRef.current?.click()}
        >
          <ImagePlus className="h-4 w-4" />
          {busy ? "Uploading…" : "Add images"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          multiple
          className="hidden"
          onChange={(e) => void onPick(e.target.files)}
        />
        <span className="text-xs text-[var(--muted)]">Max 8MB · jpeg/png/gif/webp</span>
      </div>
      {error ? <p className="text-xs text-[var(--danger)]">{error}</p> : null}
      {attachments.length ? (
        <ul className="flex flex-wrap gap-3">
          {attachments.map((a) => (
            <li key={a.id} className="relative w-28 border border-[var(--line)] bg-[var(--bg)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={mediaURL(a.url)}
                alt={a.filename}
                className="h-24 w-full object-cover"
              />
              <p className="truncate px-1.5 py-1 text-[10px] text-[var(--muted)]">
                {a.filename}
              </p>
              <button
                type="button"
                className="absolute right-1 top-1 bg-[var(--bg)]/80 p-0.5 text-[var(--muted)] hover:text-[var(--danger)]"
                onClick={() => onChange(attachments.filter((x) => x.id !== a.id))}
                aria-label="Remove"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
