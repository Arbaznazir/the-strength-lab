import Link from "next/link";

const MENTION_SPLIT = /(@[a-zA-Z0-9_]+)/g;

function isMention(segment: string) {
  return /^@[a-zA-Z0-9_]+$/.test(segment);
}

type MentionOptions = {
  /** Set false inside another link (e.g. alert rows) to avoid invalid nested anchors. */
  linkMentions?: boolean;
};

export function renderTextWithMentions(text: string, options: MentionOptions = {}) {
  const linkMentions = options.linkMentions ?? true;

  return text.split(MENTION_SPLIT).map((segment, i) => {
    if (!segment || !isMention(segment)) {
      return segment ? <span key={i}>{segment}</span> : null;
    }
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
  });
}
