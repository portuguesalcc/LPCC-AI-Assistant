"use client";

import { useState } from "react";

export default function Admin() {
  const [secret, setSecret] = useState("");
  const [running, setRunning] = useState<"sync" | "diagnose" | null>(null);
  const [result, setResult] = useState<string | null>(null);

  async function call(action: "sync" | "diagnose") {
    setRunning(action);
    setResult(null);
    try {
      const res = await fetch(`/api/${action}`, {
        method: "POST",
        headers: { "x-admin-secret": secret },
      });
      const text = await res.text();
      try {
        setResult(JSON.stringify(JSON.parse(text), null, 2));
      } catch {
        // Vercel returns plain text when a function crashes or times out.
        setResult(`HTTP ${res.status}\n${text}`);
      }
    } catch (err) {
      setResult(String(err));
    } finally {
      setRunning(null);
    }
  }

  return (
    <main className="page">
      <h1>Administração do assistente</h1>
      <label htmlFor="secret">Palavra-passe de administração</label>
      <br />
      <input
        id="secret"
        type="password"
        value={secret}
        onChange={(e) => setSecret(e.target.value)}
        autoComplete="current-password"
      />

      <h2>Sincronizar documentos</h2>
      <p>
        Atualiza o assistente com as alterações na pasta do Google Drive. Isto também acontece
        automaticamente uma vez por dia. Ficheiros novos podem demorar alguns minutos a ficar
        disponíveis depois da sincronização.
      </p>
      <button className="primary" onClick={() => call("sync")} disabled={!!running || !secret}>
        {running === "sync" ? "A sincronizar… (pode demorar alguns minutos)" : "Sincronizar agora"}
      </button>

      <h2>Diagnóstico</h2>
      <p>Testa a ligação ao Gemini e aos documentos, e mostra o erro exato se algo falhar.</p>
      <button className="primary" onClick={() => call("diagnose")} disabled={!!running || !secret}>
        {running === "diagnose" ? "A testar…" : "Testar assistente"}
      </button>

      {result && <pre>{result}</pre>}
    </main>
  );
}
