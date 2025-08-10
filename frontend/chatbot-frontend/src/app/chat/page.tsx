"use client";
import { useEffect, useRef, useState } from "react";
import { getChatLogs, sendMessage, logout, type ChatOut } from "@/lib/api";
import { useRouter } from "next/navigation";

type Msg = { id:string; role:"user"|"assistant"; text:string };

export default function ChatPage() {
  const router = useRouter();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!localStorage.getItem("jwt")) { router.replace("/login"); return; }
    (async () => {
      try {
        const rows: ChatOut[] = await getChatLogs(); // GET /chat/logs
        const arr: Msg[] = [];
        for (const r of rows) {
          arr.push({ id:`u-${r.id}`, role:"user", text:r.message });
          if (r.reply) arr.push({ id:`a-${r.id}`, role:"assistant", text:r.reply });
        }
        setMsgs(arr);
      } catch {
        router.replace("/login");
      }
    })();
  }, [router]);

  useEffect(() => { bottomRef.current?.scrollIntoView({behavior:"smooth"}); }, [msgs]);

  async function onSend(e: React.FormEvent) {
    e.preventDefault();
    const m = input.trim(); if (!m) return;
    setMsgs(s=>[...s, { id:crypto.randomUUID(), role:"user", text:m }]);
    setInput(""); setBusy(true);
    try {
      const row = await sendMessage(m); // POST /chat → full row {id,msg,reply,timestamp}
      setMsgs(s=>[...s, { id:crypto.randomUUID(), role:"assistant", text:row.reply }]);
    } catch (e:any) {
      setMsgs(s=>[...s, { id:crypto.randomUUID(), role:"assistant", text:`Error: ${e?.message ?? "failed"}` }]);
    } finally { setBusy(false); }
  }

  function onLogout() { logout(); router.replace("/login"); }

  return (
    <div className="mx-auto max-w-3xl p-4 flex flex-col gap-3 h-[90vh]">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-semibold">Chatbot</h1>
        <button className="text-sm underline" onClick={onLogout}>Log out</button>
      </div>

      <div className="flex-1 border rounded p-3 overflow-auto space-y-2">
        {msgs.map(m=>(
          <div key={m.id}
               className={`max-w-[80%] px-3 py-2 rounded-2xl whitespace-pre-wrap text-sm ${m.role==="user"?"ml-auto bg-black text-white":"mr-auto bg-gray-100"}`}>
            {m.text}
          </div>
        ))}
        <div ref={bottomRef}/>
      </div>

      <form onSubmit={onSend} className="flex gap-2">
        <input className="flex-1 border rounded p-2" value={input} onChange={(e)=>setInput(e.target.value)} placeholder="Type a message…" disabled={busy}/>
        <button className="rounded px-4 bg-black text-white disabled:opacity-60" disabled={busy || !input.trim()}>Send</button>
      </form>
    </div>
  );
}