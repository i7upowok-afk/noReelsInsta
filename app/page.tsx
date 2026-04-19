import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-lg rounded-xl border border-slate-800 bg-slate-900 p-6 space-y-4">
        <h1 className="text-2xl font-bold">NoReels Instagram Manager</h1>
        <p className="text-slate-300">Distraction-free dashboard for publishing and managing Instagram activity using official Meta APIs only.</p>
        <Link href="/dashboard" className="inline-block rounded bg-blue-500 px-4 py-2 font-semibold text-slate-950">Open Dashboard</Link>
      </div>
    </main>
  );
}
