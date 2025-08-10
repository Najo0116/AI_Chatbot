"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { login } from "@/lib/api";

export default function LoginPage() {
  const r = useRouter();
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setBusy(true);
    try {
      await login(u, p); // hits /login (form-encoded), stores JWT
      r.replace("/chat");
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      setErrorMsg(msg || "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto mt-24 max-w-sm space-y-3 p-4">
      <h1 className="text-2xl font-semibold">Sign in</h1>
      <input className="w-full border rounded p-2" placeholder="Username" value={u} onChange={(e)=>setU(e.target.value)} required />
      <input className="w-full border rounded p-2" placeholder="Password" type="password" value={p} onChange={(e)=>setP(e.target.value)} required />
      {errorMsg && <p className="text-sm text-red-600">{errorMsg}</p>}
      <button className="w-full rounded bg-black text-white py-2 disabled:opacity-60" disabled={busy}>
        {busy ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
