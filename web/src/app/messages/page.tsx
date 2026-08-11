export default function MessagesPage() {
  return (
    <div className="flex flex-1 items-center justify-center px-6 py-16 text-center">
      <div>
        <p className="text-sm font-medium text-[var(--fg)]">
          Select a conversation
        </p>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Pick someone from your inbox, or start a new message.
        </p>
      </div>
    </div>
  );
}
