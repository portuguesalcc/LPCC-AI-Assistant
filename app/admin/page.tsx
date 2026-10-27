"use client";

import { useState } from "react";

export default function Admin() {
  const [secret, setSecret] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function syncNow() {
    setRunning(true);
    setResult(null);
    try {
      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { "x-admin-secret": secret },
      });
      setResult(JSON.stringify(await res.json(), null, 2));
    } catch (err) {
      setResult(String(err));
    } finally {
      setRunning(false);
    }
  }

  return (
    <main className="page">
      <h1>Sincronizar documentos</h1>
      <p>
        Atualiza o assistente com as alterações na pasta do Google Drive. Isto também acontece
        automaticamente uma vez por dia. Ficheiros novos podem demorar alguns minutos a ficar
        disponíveis depois da sincronização.
      </p>
      <label htmlFor="secret">Palavra-passe de administração</label>
      <br />
      <input
        id="secret"
        type="password"
        value={secret}
        onChange={(e) => setSecret(e.target.value)}
        autoComplete="current-password"
      />
      <br />
      <button className="primary" onClick={syncNow} disabled={running || !secret}>
        {running ? "A sincronizar… (pode demorar alguns minutos)" : "Sincronizar agora"}
      </button>
      {result && <pre>{result}</pre>}
    </main>
  );
}
