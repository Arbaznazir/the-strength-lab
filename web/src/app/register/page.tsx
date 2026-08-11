"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await register(username, email, password);
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container-lab mx-auto flex min-h-[calc(100svh-8rem)] max-w-md flex-col justify-center space-y-6 py-10 sm:py-12">
      <div>
        <p className="kicker">Account</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
          Join the lab
        </h1>
        <p className="mt-2 text-[var(--muted)]">
          Create your account and get under the bar with the community.
        </p>
      </div>

      <form
        onSubmit={(e) => void onSubmit(e)}
        className="space-y-4 border border-[var(--line)] bg-[var(--bg-elevated)] p-5"
      >
        <label className="block space-y-1.5">
          <span className="kicker !normal-case !tracking-normal">Username</span>
          <input
            className="field w-full"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            minLength={3}
            maxLength={24}
            required
          />
        </label>
        <label className="block space-y-1.5">
          <span className="kicker !normal-case !tracking-normal">Email</span>
          <input
            type="email"
            className="field w-full"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
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
            autoComplete="new-password"
            minLength={8}
            required
          />
        </label>
        {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
        <button type="submit" className="btn-primary w-full" disabled={busy}>
          {busy ? "Creating…" : "Create account"}
        </button>
      </form>

      <p className="text-center text-sm text-[var(--muted)]">
        Already have an account?{" "}
        <Link href="/login" className="text-[var(--accent)] hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
