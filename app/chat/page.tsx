import { useEffect, useState } from 'react';

// Quick fix: define api helper
const api = (path: string) => `/api${path}`;

export default function ChatPage() {
  const [me, setMe] = useState<any>(null);

  useEffect(() => {
    fetch(api('/me'), { credentials: 'include' })
      .then(r => r.json())
      .then(j => { if (j.ok) setMe(j.data); });
  }, []);

  return <div>Chat Page</div>;
}
