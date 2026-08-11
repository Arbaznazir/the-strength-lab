"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";

const demos = ["coach", "spotter", "lifter"];
const BG =
  "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=1800&q=80";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [loginName, setLoginName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await login(loginName, password);
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-[calc(100svh-8rem)] md:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-[#0a0c0b] md:block">
        <Image src={BG} alt="" fill className="object-cover opacity-50" sizes="50vw" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0c0b] via-[#0a0c0b]/40 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-10 text-[#f2eee6]">
          <p className="text-3xl font-bold tracking-tight">
            The Strength <span className="text-[var(--accent)]">Lab</span>
          </p>
          <p className="mt-3 max-w-sm text-white/65">
            Sign in to post, react, and train with the community.
          </p>
        </div>
      </div>

      <div className="container-lab flex max-w-md flex-col justify-center py-12 md:max-w-none md:px-10 lg:px-16">
        <div className="mx-auto w-full max-w-md space-y-6">
          <div>
            <p className="kicker">Account</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
              Welcome back
            </h1>
          </div>

          <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
            <label className="block space-y-1.5">
              <span className="kicker !normal-case !tracking-normal">Username or email</span>
              <input
                className="field w-full"
                value={loginName}
                onChange={(e) => setLoginName(e.target.value)}
                autoComplete="username"
                required
              />
            </label>
            <label className="block space-y-1.5">
              <span className="kicker !normal-case !tracking-normal">Password</span>
              <input
                type="password"
                className="field w-full"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </label>
            {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
            <button type="submit" className="btn-primary w-full" disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <div className="border-t border-[var(--line)] pt-5">
            <p className="text-xs text-[var(--muted)]">
              Demo · password <code className="text-[var(--accent)]">password123</code>
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {demos.map((name) => (
                <button
                  key={name}
                  type="button"
                  className="btn-ghost !px-3 !py-1.5 text-xs"
                  onClick={() => {
                    setLoginName(name);
                    setPassword("password123");
                  }}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>

          <p className="text-sm text-[var(--muted)]">
            New here?{" "}
            <Link href="/register" className="font-semibold text-[var(--accent)] hover:underline">
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
