"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { relativeTime } from "@/lib/format";
import type { UserPublic } from "@/lib/types";
import { Avatar } from "@/components/Avatar";
import { AdminPagination } from "@/components/admin/AdminPagination";

type AdminUser = UserPublic & {
  banned: boolean;
  banReason: string;
  bannedAt?: string;
};

type Role = {
  slug: string;
  label: string;
  isStaff: boolean;
  isProtected: boolean;
};

const PAGE_SIZE = 20;

export default function AdminUsersPage() {
  const { user } = useAuth();
  const admin = isAdmin(user);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [roles, setRoles] = useState<Role[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [newRoleSlug, setNewRoleSlug] = useState("");
  const [newRoleLabel, setNewRoleLabel] = useState("");
  const [newRoleStaff, setNewRoleStaff] = useState(false);

  const assignableRoles = roles.filter((r) => !r.isProtected);

  async function loadRoles() {
    try {
      const data = await apiFetch<{ roles: Role[] }>("/admin/roles");
      setRoles(data.roles);
    } catch {
      /* optional */
    }
  }

  async function load(search = q, nextPage = page) {
    try {
      const params = new URLSearchParams({
        page: String(nextPage),
        limit: String(PAGE_SIZE),
      });
      if (search.trim()) params.set("q", search.trim());
      const data = await apiFetch<{ users: AdminUser[]; total: number }>(
        `/admin/users?${params}`,
      );
      setUsers(data.users);
      setTotal(data.total);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load users");
    }
  }

  useEffect(() => {
    void loadRoles();
    void load("", 1);
  }, []);

  async function patchUser(id: string, body: Record<string, unknown>) {
    setBusy(id);
    try {
      await apiFetch(`/admin/users/${id}`, { method: "PATCH", body });
      await load(q, page);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy("");
    }
  }

  async function createRole(e: React.FormEvent) {
    e.preventDefault();
    if (!newRoleSlug.trim()) return;
    setBusy("new-role");
    try {
      await apiFetch("/admin/roles", {
        method: "POST",
        body: {
          slug: newRoleSlug.trim().toLowerCase(),
          label: newRoleLabel.trim() || newRoleSlug.trim(),
          isStaff: newRoleStaff,
        },
      });
      setNewRoleSlug("");
      setNewRoleLabel("");
      setNewRoleStaff(false);
      await loadRoles();
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create role");
    } finally {
      setBusy("");
    }
  }

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    void load(q, 1);
  }

  function roleLabel(slug: string) {
    return roles.find((r) => r.slug === slug)?.label ?? slug;
  }

  function canSuspend(u: AdminUser) {
    const role = roles.find((r) => r.slug === u.role);
    return !role?.isProtected && u.id !== user?.id;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Users</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Search members, assign roles, or suspend accounts. Admin accounts are hidden here.
        </p>
      </div>

      {admin ? (
        <section className="space-y-3 border border-[var(--line)] bg-[var(--bg-elevated)] p-4">
          <h3 className="text-sm font-semibold">Roles</h3>
          <p className="text-xs text-[var(--muted)]">
            Create custom roles and assign them to members. Staff roles grant moderation access
            after the user signs in again.
          </p>
          <div className="flex flex-wrap gap-2">
            {roles.map((r) => (
              <span
                key={r.slug}
                className="rounded border border-[var(--line)] px-2 py-1 text-xs"
                title={r.isProtected ? "Protected" : r.isStaff ? "Staff" : "Member role"}
              >
                {r.label}
                {r.isStaff ? " · staff" : ""}
                {r.isProtected ? " · protected" : ""}
              </span>
            ))}
          </div>
          <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => void createRole(e)}>
            <label className="space-y-1">
              <span className="text-[10px] uppercase tracking-wide text-[var(--muted)]">Slug</span>
              <input
                value={newRoleSlug}
                onChange={(e) => setNewRoleSlug(e.target.value)}
                placeholder="vip"
                className="block w-28 border border-[var(--line)] bg-[var(--bg)] px-2 py-1.5 text-sm"
              />
            </label>
            <label className="min-w-[8rem] flex-1 space-y-1">
              <span className="text-[10px] uppercase tracking-wide text-[var(--muted)]">Label</span>
              <input
                value={newRoleLabel}
                onChange={(e) => setNewRoleLabel(e.target.value)}
                placeholder="VIP Member"
                className="block w-full border border-[var(--line)] bg-[var(--bg)] px-2 py-1.5 text-sm"
              />
            </label>
            <label className="flex items-center gap-2 pb-1.5 text-xs">
              <input
                type="checkbox"
                checked={newRoleStaff}
                onChange={(e) => setNewRoleStaff(e.target.checked)}
              />
              Staff access
            </label>
            <button
              type="submit"
              disabled={busy === "new-role" || !newRoleSlug.trim()}
              className="btn-primary !px-3 !py-1.5 text-sm"
            >
              Add role
            </button>
          </form>
        </section>
      ) : null}

      <form className="flex gap-2" onSubmit={onSearch}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search username or name…"
          className="flex-1 border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm"
        />
        <button type="submit" className="btn-primary !px-4 !py-2 text-sm">
          Search
        </button>
      </form>

      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}

      <ul className="divide-y divide-[var(--line)] border border-[var(--line)] bg-[var(--bg-elevated)]">
        {users.map((u) => (
          <li key={u.id} className="flex flex-wrap items-start gap-4 px-4 py-4">
            <Avatar user={u} size="md" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/members/${u.username}`}
                  className="font-semibold hover:text-[var(--accent)]"
                >
                  {u.displayName}
                </Link>
                <span className="text-xs text-[var(--muted)]">@{u.username}</span>
                <span className="rounded bg-[var(--accent-dim)] px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-[var(--accent)]">
                  {roleLabel(u.role)}
                </span>
                {u.banned ? (
                  <span className="rounded bg-[var(--danger)]/15 px-1.5 py-0.5 text-[10px] uppercase text-[var(--danger)]">
                    Banned
                  </span>
                ) : null}
              </div>
              <p className="text-xs text-[var(--muted)]">
                {u.messageCount} posts · joined {relativeTime(u.createdAt)}
                {u.banned && u.banReason ? ` · ${u.banReason}` : ""}
              </p>
              <div className="flex flex-wrap gap-2">
                {admin ? (
                  <select
                    value={u.role}
                    disabled={busy === u.id}
                    onChange={(e) =>
                      void patchUser(u.id, { role: e.target.value })
                    }
                    className="border border-[var(--line)] bg-[var(--bg)] px-2 py-1 text-xs"
                  >
                    {assignableRoles.map((r) => (
                      <option key={r.slug} value={r.slug}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                ) : null}
                {canSuspend(u) ? (
                  !u.banned ? (
                    <button
                      type="button"
                      disabled={busy === u.id}
                      onClick={() =>
                        void patchUser(u.id, {
                          banned: true,
                          banReason: "Suspended by staff",
                        })
                      }
                      className="border border-[var(--danger)]/40 px-2 py-1 text-xs text-[var(--danger)] hover:bg-[var(--danger)]/10"
                    >
                      Suspend
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={busy === u.id}
                      onClick={() => void patchUser(u.id, { banned: false })}
                      className="border border-[var(--line)] px-2 py-1 text-xs hover:border-[var(--accent)]"
                    >
                      Unban
                    </button>
                  )
                ) : null}
              </div>
            </div>
          </li>
        ))}
      </ul>

      {!users.length ? (
        <p className="text-sm text-[var(--muted)]">No users found.</p>
      ) : null}

      <AdminPagination
        page={page}
        total={total}
        limit={PAGE_SIZE}
        onPage={(p) => {
          setPage(p);
          void load(q, p);
        }}
      />
    </div>
  );
}
