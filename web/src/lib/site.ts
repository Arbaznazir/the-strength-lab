export type SocialPlatform =
  | "twitter"
  | "facebook"
  | "instagram"
  | "youtube"
  | "twitch"
  | "discord"
  | "linkedin";

export type SocialLink = {
  id: SocialPlatform;
  label: string;
  href: string;
};

export function getSocialLinks(): SocialLink[] {
  const entries: { id: SocialPlatform; label: string; href?: string }[] = [
    { id: "twitter", label: "X (Twitter)", href: process.env.NEXT_PUBLIC_SOCIAL_TWITTER },
    { id: "facebook", label: "Facebook", href: process.env.NEXT_PUBLIC_SOCIAL_FACEBOOK },
    { id: "instagram", label: "Instagram", href: process.env.NEXT_PUBLIC_SOCIAL_INSTAGRAM },
    { id: "youtube", label: "YouTube", href: process.env.NEXT_PUBLIC_SOCIAL_YOUTUBE },
    { id: "twitch", label: "Twitch", href: process.env.NEXT_PUBLIC_SOCIAL_TWITCH },
    { id: "discord", label: "Discord", href: process.env.NEXT_PUBLIC_SOCIAL_DISCORD },
    { id: "linkedin", label: "LinkedIn", href: process.env.NEXT_PUBLIC_SOCIAL_LINKEDIN },
  ];

  return entries
    .map(({ id, label, href }) => {
      const url = href?.trim();
      return url ? { id, label, href: url } : null;
    })
    .filter((link): link is SocialLink => link !== null);
}

export const CONTACT_EMAIL =
  process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim() ||
  "contact@thestrengthlab.com";

export function contactMailto(): string {
  const subject = encodeURIComponent("The Strength Lab — contact");
  return `mailto:${CONTACT_EMAIL}?subject=${subject}`;
}

export function siteURL(): string {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "http://localhost:3000"
  );
}

export function threadShareURL(threadSlug: string): string {
  return `${siteURL()}/threads/${threadSlug}`;
}

export function postShareURL(threadSlug: string, postId: string): string {
  return `${threadShareURL(threadSlug)}#post-${postId}`;
}

export function chatShareURL(): string {
  return `${siteURL()}/chat`;
}

export function chatMessageShareURL(messageId: string): string {
  return `${chatShareURL()}#msg-${messageId}`;
}

export function messageShareURL(conversationId: string, messageId: string): string {
  return `${siteURL()}/messages/${conversationId}#msg-${messageId}`;
}

export type ShareTarget =
  | "twitter"
  | "facebook"
  | "linkedin"
  | "reddit"
  | "pinterest"
  | "tumblr"
  | "whatsapp"
  | "email";

export const SHARE_TARGETS: { id: ShareTarget; label: string }[] = [
  { id: "facebook", label: "Facebook" },
  { id: "twitter", label: "X" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "reddit", label: "Reddit" },
  { id: "pinterest", label: "Pinterest" },
  { id: "tumblr", label: "Tumblr" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "email", label: "Email" },
];

export function buildShareLink(
  target: ShareTarget,
  url: string,
  text: string,
): string {
  const encodedUrl = encodeURIComponent(url);
  const encodedText = encodeURIComponent(text);

  switch (target) {
    case "twitter":
      return `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedText}`;
    case "facebook":
      return `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
    case "linkedin":
      return `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`;
    case "reddit":
      return `https://www.reddit.com/submit?url=${encodedUrl}&title=${encodedText}`;
    case "pinterest":
      return `https://pinterest.com/pin/create/button/?url=${encodedUrl}&description=${encodedText}`;
    case "tumblr":
      return `https://www.tumblr.com/widgets/share/tool?posttype=link&title=${encodedText}&content=${encodedUrl}`;
    case "whatsapp":
      return `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`;
    case "email":
      return `mailto:?subject=${encodedText}&body=${encodeURIComponent(`${text}\n\n${url}`)}`;
  }
}
