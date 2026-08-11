"use client";

import { useEffect, useId, useRef, useState } from "react";
import clsx from "clsx";
import type { UserPublic } from "@/lib/types";
import { Avatar } from "./Avatar";
import { useMemberSuggest } from "@/lib/useMemberSuggest";

type UserAutocompleteProps = {
  value: string;
  onChange: (username: string) => void;
  onSelect?: (user: UserPublic) => void;
  placeholder?: string;
  excludeUsername?: string;
  required?: boolean;
  className?: string;
};

export function UserAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = "Search by name or username…",
  excludeUsername,
  required,
  className,
}: UserAutocompleteProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const { results, loading } = useMemberSuggest(value, excludeUsername);

  useEffect(() => {
    setActive(0);
  }, [results]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function pick(user: UserPublic) {
    onChange(user.username);
    onSelect?.(user);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || !results.length) {
      if (e.key === "ArrowDown" && results.length) setOpen(true);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === "Enter" && open && results[active]) {
      e.preventDefault();
      pick(results[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const showDropdown = open && value.trim().length >= 1;

  return (
    <div ref={rootRef} className={clsx("relative", className)}>
      <input
        className="field w-full"
        placeholder={placeholder}
        value={value}
        required={required}
        autoComplete="off"
        role="combobox"
        aria-expanded={showDropdown}
        aria-controls={listId}
        aria-autocomplete="list"
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
      />

      {showDropdown ? (
        <MemberSuggestList
          id={listId}
          results={results}
          active={active}
          loading={loading}
          onPick={pick}
          onHover={setActive}
          className="absolute z-40 mt-1 w-full"
        />
      ) : null}
    </div>
  );
}

type SuggestListProps = {
  id?: string;
  results: UserPublic[];
  active: number;
  loading: boolean;
  onPick: (user: UserPublic) => void;
  onHover: (index: number) => void;
  className?: string;
};

export function MemberSuggestList({
  id,
  results,
  active,
  loading,
  onPick,
  onHover,
  className,
}: SuggestListProps) {
  if (!loading && !results.length) {
    return (
      <div
        id={id}
        className={clsx(
          "border border-[var(--line-strong)] bg-[var(--bg-elevated)] px-3 py-2.5 text-sm text-[var(--muted)] shadow-2xl",
          className,
        )}
      >
        No members found
      </div>
    );
  }

  return (
    <ul
      id={id}
      role="listbox"
      className={clsx(
        "max-h-48 overflow-y-auto border border-[var(--line-strong)] bg-[var(--bg-elevated)] shadow-2xl",
        className,
      )}
    >
      {loading && !results.length ? (
        <li className="px-3 py-2.5 text-sm text-[var(--muted)]">Searching…</li>
      ) : null}
      {results.map((user, i) => (
        <li key={user.id} role="option" aria-selected={i === active}>
          <button
            type="button"
            className={clsx(
              "flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors",
              i === active
                ? "bg-[var(--accent-dim)]"
                : "hover:bg-[var(--accent-dim)]",
            )}
            onMouseEnter={() => onHover(i)}
            onClick={() => onPick(user)}
          >
            <Avatar user={user} size="sm" link={false} />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{user.displayName}</p>
              <p className="truncate text-xs text-[var(--muted)]">
                @{user.username}
                {user.title ? ` · ${user.title}` : ""}
              </p>
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}
