import Link from "next/link";

const MENTION_SPLIT = /(@[a-zA-Z0-9_]+)/g;
const URL_SPLIT = /(https?:\/\/[^\s<]+[^<>\s.,;:!?)\]'"])/gi;

function isMention(segment: string) {
  return /^@[a-zA-Z0-9_]+$/.test(segment);
}

function isUrl(segment: string) {
  return /^https?:\/\//i.test(segment);
}

type MentionOptions = {
  /** Set false inside another link (e.g. alert rows) to avoid invalid nested anchors. */
  linkMentions?: boolean;
};

function renderUrls(text: string, keyPrefix: string) {
  return text.split(URL_SPLIT).map((part, i) => {
    if (!part) return null;
    if (isUrl(part)) {
      return (
        <a
          key={`${keyPrefix}-url-${i}`}
          href={part}
          target="_blank"
          rel="noopener noreferrer sponsored"
          className="break-all text-[var(--accent)] underline-offset-2 hover:underline"
        >
          {part}
        </a>
      );
    }
    return <span key={`${keyPrefix}-t-${i}`}>{part}</span>;
  });
}

export function renderTextWithMentions(text: string, options: MentionOptions = {}) {
  const linkMentions = options.linkMentions ?? true;

  return text.split(MENTION_SPLIT).map((segment, i) => {
    if (!segment) return null;
    if (isMention(segment)) {
      const username = segment.slice(1).toLowerCase();
      if (linkMentions) {
        return (
          <Link key={i} href={`/members/${username}`} className="mention">
            {segment}
          </Link>
        );
      }
      return (
        <span key={i} className="mention">
          {segment}
        </span>
      );
    }
    return <span key={i}>{renderUrls(segment, String(i))}</span>;
  });
}
