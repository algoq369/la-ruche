"use client";

import { useEffect, useState } from "react";

// ✅ Define the missing `api` helper
const api = (path: string) => `/api${path}`;

export default function ChatPage() {
  const [me, setMe] = useState<any>(null);

  useEffect(() => {
    // Load current user
    fetch(api("/me"), { credentials: "include" })
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setMe(j.data);
      });

    let closed = false;
    async function connect() {
      if (closed) return;
      // Optional: WebSocket or polling logic can go here
    }
    connect();

    return () => {
      closed = true;
    };
  }, []);

  return (
    <main>
      <h1>Chat</h1>
      {me ? <p>Welcome, {me.name}!</p> : <p>Loading...</p>}
    </main>
  );
}
