"use client";

import { useRef, useState } from "react";
import clsx from "clsx";
import type { UserPublic } from "@/lib/types";
import { mentionQueryAt, useMemberSuggest } from "@/lib/useMemberSuggest";
import { MemberSuggestList } from "./UserAutocomplete";

type MentionInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  excludeUsername?: string;
  className?: string;
  rows?: number;
  multiline?: boolean;
  required?: boolean;
};

export function MentionInput({
  value,
  onChange,
  placeholder,
  maxLength,
  excludeUsername,
  className,
  rows = 1,
  multiline = false,
  required,
}: MentionInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [cursor, setCursor] = useState(0);
  const [active, setActive] = useState(0);
  const mention = mentionQueryAt(value, cursor);
  const { results, loading } = useMemberSuggest(
    mention?.query ?? "",
    excludeUsername,
  );
  const showMentions = mention !== null && mention.query.length >= 1;

  function updateCursor() {
    const el = multiline ? textareaRef.current : inputRef.current;
    if (el) setCursor(el.selectionStart ?? value.length);
  }

  function insertMention(user: UserPublic) {
    if (!mention) return;
    const before = value.slice(0, mention.start);
    const after = value.slice(cursor);
    const next = `${before}@${user.username} ${after}`;
    onChange(next);
    const pos = before.length + user.username.length + 2;
    window.requestAnimationFrame(() => {
      const el = multiline ? textareaRef.current : inputRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(pos, pos);
        setCursor(pos);
      }
    });
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!showMentions || !results.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      insertMention(results[active]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setActive(0);
    }
  }

  function onChangeField(next: string, selectionStart: number | null) {
    onChange(next);
    setCursor(selectionStart ?? next.length);
    setActive(0);
  }

  return (
    <div
      className={clsx(
        "relative",
        multiline ? "w-full" : "min-w-0 flex-1",
      )}
    >
      {multiline ? (
        <textarea
          ref={textareaRef}
          className={clsx("field w-full", className)}
          placeholder={placeholder}
          value={value}
          maxLength={maxLength}
          rows={rows}
          required={required}
          onKeyDown={onKeyDown}
          onClick={updateCursor}
          onKeyUp={updateCursor}
          onSelect={updateCursor}
          onChange={(e) => onChangeField(e.target.value, e.target.selectionStart)}
        />
      ) : (
        <input
          ref={inputRef}
          className={clsx("field w-full", className)}
          placeholder={placeholder}
          value={value}
          maxLength={maxLength}
          required={required}
          onKeyDown={onKeyDown}
          onClick={updateCursor}
          onKeyUp={updateCursor}
          onSelect={updateCursor}
          onChange={(e) => onChangeField(e.target.value, e.target.selectionStart)}
        />
      )}

      {showMentions ? (
        <MemberSuggestList
          results={results}
          active={active}
          loading={loading}
          onPick={insertMention}
          onHover={setActive}
          className="absolute left-0 z-40 w-full min-w-[14rem] top-full mt-1 md:bottom-full md:top-auto md:mb-1 md:mt-0 max-h-[min(12rem,40vh)] overflow-y-auto"
        />
      ) : null}

      {multiline ? (
        <p className="mt-1 text-[10px] text-[var(--muted)]">
          Type <span className="text-[var(--accent)]">@</span> to mention a member
        </p>
      ) : null}
    </div>
  );
}
