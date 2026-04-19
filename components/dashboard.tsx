'use client';

import React, { FormEvent, useEffect, useMemo, useState } from 'react';

type Tab = 'Create' | 'Drafts' | 'Posts' | 'Comments' | 'Insights';

type ApiState = {
  connected: boolean;
  username?: string;
  mock: boolean;
};

export default function Dashboard() {
  const tabs: Tab[] = ['Create', 'Drafts', 'Posts', 'Comments', 'Insights'];
  const [tab, setTab] = useState<Tab>('Create');
  const [session, setSession] = useState<ApiState>({ connected: false, mock: true });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const [caption, setCaption] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [filePreview, setFilePreview] = useState<string>('');

  const [drafts, setDrafts] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [insights, setInsights] = useState<any[]>([]);

  async function call<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...init });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Request failed');
    return json as T;
  }

  async function refresh() {
    try {
      const s = await call<ApiState>('/api/session');
      setSession(s);
      const [d, p, c, i] = await Promise.all([
        call<any[]>('/api/drafts'),
        call<any[]>('/api/posts'),
        call<any[]>('/api/comments'),
        call<any[]>('/api/insights')
      ]);
      setDrafts(d);
      setPosts(p);
      setComments(c);
      setInsights(i);
    } catch (e: any) {
      setMessage(e.message);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const previewSrc = useMemo(() => filePreview || mediaUrl, [filePreview, mediaUrl]);

  async function onOAuthStart() {
    const res = await call<{ url: string }>('/api/oauth/start');
    window.location.href = res.url;
  }

  async function onSaveDraft(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      await call('/api/drafts', {
        method: 'POST',
        body: JSON.stringify({ caption, mediaUrl, previewUrl: previewSrc })
      });
      setCaption('');
      setMediaUrl('');
      setFilePreview('');
      await refresh();
      setMessage('Draft saved.');
    } catch (err: any) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function onPublish() {
    setLoading(true);
    setMessage('');
    try {
      await call('/api/publish', {
        method: 'POST',
        body: JSON.stringify({ caption, mediaUrl })
      });
      await refresh();
      setMessage('Post published.');
    } catch (err: any) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function onReply(commentId: string) {
    const text = prompt('Reply text');
    if (!text) return;
    try {
      await call('/api/comments/reply', { method: 'POST', body: JSON.stringify({ commentId, text }) });
      setMessage('Reply sent.');
    } catch (err: any) {
      setMessage(err.message);
    }
  }

  return (
    <main className="min-h-screen p-6">
      <div className="mx-auto max-w-5xl space-y-4">
        <header className="rounded-xl border border-slate-800 bg-slate-900 p-4 flex flex-wrap gap-3 items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Instagram Manager Dashboard</h1>
            <p className="text-sm text-slate-400">No feed / explore / reels / follower browsing.</p>
          </div>
          <div className="flex items-center gap-2">
            {!session.connected ? (
              <button className="rounded bg-blue-500 px-3 py-2 text-slate-950 font-semibold" onClick={onOAuthStart}>Sign in with Instagram (Meta OAuth)</button>
            ) : (
              <span className="text-sm text-emerald-400">Connected as @{session.username || 'instagram_user'}</span>
            )}
            <button className="rounded bg-slate-700 px-3 py-2" onClick={refresh}>Refresh</button>
          </div>
        </header>

        {session.mock && <p className="rounded border border-amber-700 bg-amber-950/40 p-3 text-amber-200 text-sm">Running in mock mode because API credentials or token are unavailable.</p>}
        {message && <p className="rounded border border-slate-700 bg-slate-900 p-3 text-sm">{message}</p>}

        <nav className="flex flex-wrap gap-2">
          {tabs.map((t) => (
            <button key={t} className={`rounded px-3 py-2 ${tab === t ? 'bg-blue-500 text-slate-950 font-semibold' : 'bg-slate-800'}`} onClick={() => setTab(t)}>{t}</button>
          ))}
        </nav>

        {tab === 'Create' && (
          <section className="rounded-xl border border-slate-800 bg-slate-900 p-4 grid md:grid-cols-2 gap-4">
            <form onSubmit={onSaveDraft} className="space-y-3">
              <label className="block text-sm">Upload media
                <input
                  className="mt-1 w-full rounded bg-slate-800 p-2"
                  type="file"
                  accept="image/*,video/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    const reader = new FileReader();
                    reader.onload = () => setFilePreview(String(reader.result || ''));
                    reader.readAsDataURL(f);
                  }}
                />
              </label>
              <label className="block text-sm">Media public URL (required for real publish)
                <input className="mt-1 w-full rounded bg-slate-800 p-2" value={mediaUrl} onChange={(e) => setMediaUrl(e.target.value)} placeholder="https://..." />
              </label>
              <label className="block text-sm">Caption
                <textarea className="mt-1 w-full rounded bg-slate-800 p-2" value={caption} onChange={(e) => setCaption(e.target.value)} rows={4} />
              </label>
              <div className="flex gap-2">
                <button disabled={loading} className="rounded bg-slate-700 px-3 py-2">Save Draft</button>
                <button disabled={loading} type="button" className="rounded bg-emerald-500 px-3 py-2 text-slate-950 font-semibold" onClick={onPublish}>Publish</button>
              </div>
            </form>
            <div className="rounded border border-slate-800 p-3">
              <h3 className="font-semibold mb-2">Preview</h3>
              {previewSrc ? <img src={previewSrc} alt="preview" className="w-full rounded max-h-80 object-cover" /> : <p className="text-slate-500 text-sm">No media selected.</p>}
              <p className="mt-3 text-sm whitespace-pre-wrap">{caption || 'Caption preview...'}</p>
            </div>
          </section>
        )}

        {tab === 'Drafts' && <ListPanel items={drafts} empty="No drafts." render={(d) => <><p className="font-semibold">{d.caption}</p><p className="text-xs text-slate-400">{d.mediaUrl}</p></>} />}
        {tab === 'Posts' && <ListPanel items={posts} empty="No posts yet." render={(p) => <><p className="font-semibold">{p.caption || '(no caption)'}</p><a className="text-blue-400 text-sm" href={p.permalink || '#'} target="_blank">Open</a></>} />}
        {tab === 'Comments' && (
          <ListPanel
            items={comments}
            empty="No comments found."
            render={(c) => (
              <div className="space-y-2">
                <p>{c.text}</p>
                <button className="rounded bg-slate-700 px-3 py-1 text-sm" onClick={() => onReply(c.id)}>Reply</button>
              </div>
            )}
          />
        )}
        {tab === 'Insights' && <ListPanel items={insights} empty="Insights unavailable." render={(i) => <p>{i.name}: <strong>{String(i.value)}</strong></p>} />}
      </div>
    </main>
  );
}

function ListPanel({ items, empty, render }: { items: any[]; empty: string; render: (item: any) => React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-3">
      {items.length === 0 ? <p className="text-slate-500">{empty}</p> : items.map((item, i) => <div key={item.id || i} className="rounded border border-slate-800 p-3">{render(item)}</div>)}
    </section>
  );
}
