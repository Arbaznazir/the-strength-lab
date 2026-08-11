"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Camera, Pencil } from "lucide-react";
import { apiFetch, apiUpload, mediaURL } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatCount, relativeTime } from "@/lib/format";
import type { ProfilePost, UserPublic } from "@/lib/types";
import { Avatar } from "@/components/Avatar";
import { MentionInput } from "@/components/MentionInput";
import { renderTextWithMentions } from "@/lib/mentions";
import { RoleBadge, TagBadges } from "@/components/TagBadge";
import { Pagination } from "@/components/Pagination";
import { PAGE_SIZE } from "@/lib/pagination";

export default function MemberProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = use(params);
  const { user, refresh } = useAuth();
  const [member, setMember] = useState<UserPublic | null>(null);
  const [posts, setPosts] = useState<ProfilePost[]>([]);
  const [postsPage, setPostsPage] = useState(1);
  const [postsTotal, setPostsTotal] = useState(0);
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [title, setTitle] = useState("");
  const [bio, setBio] = useState("");
  const avatarRef = useRef<HTMLInputElement>(null);
  const bannerRef = useRef<HTMLInputElement>(null);

  const isOwn = !!user && user.username.toLowerCase() === username.toLowerCase();

  async function loadPosts(page = postsPage) {
    const p = await apiFetch<{ posts: ProfilePost[]; total?: number }>(
      `/members/${username}/profile-posts?page=${page}&limit=${PAGE_SIZE}`,
      { auth: false },
    );
    setPosts(p.posts);
    setPostsTotal(p.total ?? p.posts.length);
    setPostsPage(page);
  }

  async function load() {
    try {
      const m = await apiFetch<UserPublic>(`/members/${username}`, {
        auth: false,
      });
      setMember(m);
      await loadPosts(1);
      setDisplayName(m.displayName || m.username);
      setTitle(m.title || "");
      setBio(m.bio || "");
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Member not found");
    }
  }

  useEffect(() => {
    void load();
  }, [username]);

  async function submitPost(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !body.trim()) return;
    setBusy(true);
    try {
      await apiFetch(`/members/${username}/profile-posts`, {
        method: "POST",
        body: { body },
      });
      setBody("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not post");
    } finally {
      setBusy(false);
    }
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!isOwn) return;
    setBusy(true);
    setError("");
    try {
      const updated = await apiFetch<UserPublic>("/me", {
        method: "PATCH",
        body: {
          displayName: displayName.trim(),
          title: title.trim(),
          bio: bio.trim(),
          avatarUrl: member?.avatarUrl || "",
          bannerUrl: member?.bannerUrl || "",
        },
      });
      setMember(updated);
      setEditing(false);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save profile");
    } finally {
      setBusy(false);
    }
  }

  async function uploadImage(file: File | undefined, purpose: "avatar" | "banner") {
    if (!file || !isOwn) return;
    setBusy(true);
    setError("");
    try {
      const res = await apiUpload(file, purpose);
      if (res.user) {
        setMember(res.user);
        await refresh();
      } else {
        await load();
        await refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  if (error && !member) {
    return (
      <p className="container-lab py-8 text-[var(--danger)] sm:py-10">{error}</p>
    );
  }

  return (
    <div className="container-lab mx-auto max-w-2xl space-y-6 py-8 sm:py-10">
      <div className="overflow-hidden border border-[var(--line)] bg-[var(--bg-elevated)]">
        <div className="relative h-32 sm:h-44">
          <div
            className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_color-mix(in_oklab,var(--accent)_25%,transparent),_transparent_70%)]"
            style={
              member?.bannerUrl
                ? {
                    backgroundImage: `url(${mediaURL(member.bannerUrl)})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }
                : undefined
            }
          />
          {isOwn ? (
            <>
              <button
                type="button"
                className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 bg-[var(--bg)]/85 px-2.5 py-1.5 text-xs font-semibold backdrop-blur hover:bg-[var(--bg)]"
                onClick={() => bannerRef.current?.click()}
                disabled={busy}
              >
                <Camera className="h-3.5 w-3.5" />
                Banner
              </button>
              <input
                ref={bannerRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => void uploadImage(e.target.files?.[0], "banner")}
              />
            </>
          ) : null}
        </div>

        <div className="-mt-14 px-5 pb-5 sm:-mt-[4.5rem]">
          <div className="relative inline-block">
            <Avatar
              user={member}
              size="profile"
              link={false}
              className="border-2 border-[var(--bg-elevated)] shadow-lg"
            />
            {isOwn ? (
              <>
                <button
                  type="button"
                  className="absolute bottom-2 right-2 rounded-full bg-[var(--accent)] p-2 text-[var(--accent-ink)] shadow-md"
                  onClick={() => avatarRef.current?.click()}
                  disabled={busy}
                  aria-label="Change avatar"
                >
                  <Camera className="h-4 w-4" />
                </button>
                <input
                  ref={avatarRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => void uploadImage(e.target.files?.[0], "avatar")}
                />
              </>
            ) : null}
          </div>

          <div className="mt-4 flex flex-wrap items-start justify-between gap-3 sm:mt-5">
            <div className="min-w-0 space-y-1">
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                {member?.displayName ?? username}
              </h1>
              <p className="text-sm text-[var(--muted)]">
                @{member?.username}
                {member?.title ? ` · ${member.title}` : ""}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <RoleBadge role={member?.role} />
                <TagBadges tags={member?.tags} />
              </div>
            </div>
            {isOwn ? (
              <button
                type="button"
                className="btn-ghost !px-3 !py-2 text-xs"
                onClick={() => setEditing((v) => !v)}
              >
                <Pencil className="h-3.5 w-3.5" />
                {editing ? "Close" : "Edit profile"}
              </button>
            ) : null}
          </div>

          {!editing && member?.bio ? (
            <p className="mt-4 whitespace-pre-wrap text-[0.9375rem] leading-relaxed text-[var(--fg)]">
              {member.bio}
            </p>
          ) : null}

          {editing && isOwn ? (
            <form onSubmit={(e) => void saveProfile(e)} className="mt-5 space-y-3 border-t border-[var(--line)] pt-5">
              <label className="block space-y-1">
                <span className="kicker !normal-case !tracking-normal">Display name</span>
                <input
                  className="field w-full"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  maxLength={40}
                  required
                />
              </label>
              <label className="block space-y-1">
                <span className="kicker !normal-case !tracking-normal">Title</span>
                <input
                  className="field w-full"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Intermediate lifter"
                  maxLength={60}
                />
              </label>
              <label className="block space-y-1">
                <span className="kicker !normal-case !tracking-normal">Bio</span>
                <textarea
                  className="field w-full"
                  rows={4}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Tell the lab who you are…"
                  maxLength={500}
                />
              </label>
              <button type="submit" className="btn-primary" disabled={busy}>
                {busy ? "Saving…" : "Save profile"}
              </button>
            </form>
          ) : null}

          <dl className="mt-5 grid grid-cols-3 gap-3 text-center">
            <div className="border border-[var(--line)] bg-[var(--bg)] p-3">
              <dt className="text-[0.65rem] font-semibold uppercase tracking-wider text-[var(--muted)]">
                Messages
              </dt>
              <dd className="mt-1 text-xl font-semibold tabular-nums tracking-tight">
                {formatCount(member?.messageCount ?? 0)}
              </dd>
            </div>
            <div className="border border-[var(--line)] bg-[var(--bg)] p-3">
              <dt className="text-[0.65rem] font-semibold uppercase tracking-wider text-[var(--muted)]">
                Reactions
              </dt>
              <dd className="mt-1 text-xl font-semibold tabular-nums tracking-tight">
                {formatCount(member?.reactionScore ?? 0)}
              </dd>
            </div>
            <div className="border border-[var(--line)] bg-[var(--bg)] p-3">
              <dt className="text-[0.65rem] font-semibold uppercase tracking-wider text-[var(--muted)]">
                Points
              </dt>
              <dd className="mt-1 text-xl font-semibold tabular-nums tracking-tight">
                {formatCount(member?.trophyPoints ?? 0)}
              </dd>
            </div>
          </dl>

          {user && !isOwn ? (
            <Link href={`/messages?to=${username}`} className="btn-ghost mt-4 text-sm">
              Send message
            </Link>
          ) : null}
        </div>
      </div>

      {user ? (
        <form
          onSubmit={(e) => void submitPost(e)}
          className="space-y-3 border border-[var(--line)] bg-[var(--bg-elevated)] p-4"
        >
          <h2 className="text-sm font-semibold">
            {isOwn ? "Post on your profile" : `Write on ${member?.displayName ?? username}'s profile`}
          </h2>
          <p className="text-xs text-[var(--muted)]">
            {isOwn
              ? "Share an update on your wall — visible to anyone visiting your profile."
              : "Your post appears on this member's profile and notifies them."}
          </p>
          <MentionInput
            value={body}
            onChange={setBody}
            placeholder={
              isOwn
                ? "Share an update… (@ to mention)"
                : `Say something to ${member?.displayName ?? username}… (@ to mention)`
            }
            rows={3}
            multiline
            required
            excludeUsername={user?.username}
          />
          <button type="submit" className="btn-primary" disabled={busy}>
            {isOwn ? "Post update" : "Post on profile"}
          </button>
        </form>
      ) : (
        <p className="border border-[var(--line)] bg-[var(--bg-elevated)] p-4 text-sm text-[var(--muted)]">
          <Link href="/login" className="font-medium text-[var(--accent)] hover:underline">
            Sign in
          </Link>{" "}
          to leave a profile post.
        </p>
      )}

      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">
          {isOwn ? "Your profile posts" : "Profile posts"}
        </h2>
        {posts.length ? (
          posts.map((p) => {
            const onOthersWall =
              p.profileUser &&
              p.author.username.toLowerCase() !== p.profileUser.username.toLowerCase();
            return (
            <article
              key={p.id}
              className="border border-[var(--line)] bg-[var(--bg-elevated)] p-4"
            >
              <div className="mb-2 flex items-center gap-2">
                <Avatar user={p.author} size="sm" />
                <div>
                  <div className="flex flex-wrap items-center gap-x-1.5 text-sm">
                    <Link
                      href={`/members/${p.author.username}`}
                      className="font-medium hover:text-[var(--accent)]"
                    >
                      {p.author.displayName}
                    </Link>
                    {onOthersWall ? (
                      <>
                        <span className="text-[var(--muted)]">on</span>
                        <Link
                          href={`/members/${p.profileUser.username}`}
                          className="font-medium hover:text-[var(--accent)]"
                        >
                          {p.profileUser.displayName}&apos;s profile
                        </Link>
                      </>
                    ) : null}
                  </div>
                  <p className="text-xs text-[var(--muted)]">
                    {relativeTime(p.createdAt)}
                  </p>
                </div>
              </div>
              <p className="whitespace-pre-wrap text-sm">{renderTextWithMentions(p.body)}</p>
            </article>
            );
          })
        ) : (
          <p className="text-[var(--muted)]">
            {isOwn
              ? "No posts on your profile yet. Share an update above."
              : "No profile posts yet. Be the first to write on this wall."}
          </p>
        )}
        <Pagination
          page={postsPage}
          total={postsTotal}
          onPage={(p) => void loadPosts(p)}
        />
      </section>
    </div>
  );
}
