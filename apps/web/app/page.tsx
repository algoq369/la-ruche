import Link from 'next/link';

export default function HomePage() {
  return (
    <div>
      <h1>Welcome to La Ruche</h1>
      <p>Private, end-to-end encrypted messaging.</p>
      <ul>
        <li><Link href="/login">Login with Passkey</Link></li>
        <li><Link href="/chat">Open Chat (demo)</Link></li>
        <li><Link href="/devices">Manage Devices</Link> &middot; <Link href="/devices/link">Link This Device</Link></li>
        <li><Link href="/media">Encrypted Media Upload</Link></li>
        <li><Link href="/keys">Keys (Dev)</Link></li>
        <li><Link href="/arena">Agents Arena</Link></li>
      </ul>
      <p style={{ color: '#b00' }}>
        Demo note: crypto is mocked in dev; integrate libsignal-client for real E2EE.
      </p>
    </div>
  );
}
