const connectBtn = document.getElementById('connect-btn');
const checkConnectionBtn = document.getElementById('check-connection');
const disconnectBtn = document.getElementById('disconnect-btn');
const sessionText = document.getElementById('session-text');
const configWarning = document.getElementById('config-warning');
const oauthError = document.getElementById('oauth-error');
const pageSelect = document.getElementById('page-select');
const draftForm = document.getElementById('draft-form');
const draftsList = document.getElementById('drafts');
const postsList = document.getElementById('posts');
const refreshPostsBtn = document.getElementById('refresh-posts');

function getQueryParam(name) {
  const url = new URL(window.location.href);
  return url.searchParams.get(name);
}

async function jsonFetch(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });

  if (res.status === 204) return null;

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function fmt(ts) {
  return ts ? new Date(ts).toLocaleString() : '—';
}

function showOauthErrorFromUrl() {
  const err = getQueryParam('error');
  if (!err) return;
  oauthError.classList.remove('hidden');
  oauthError.textContent = `Connection failed: ${err}`;
}

async function loadConfig() {
  const config = await jsonFetch('/api/config');
  if (!config.hasOauthConfig) {
    configWarning.classList.remove('hidden');
    configWarning.textContent = `Missing env vars: ${config.missing.join(', ')}`;
    connectBtn.disabled = true;
  }
}

function renderPageSelect(session) {
  pageSelect.innerHTML = '';

  if (!session.pages.length) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = 'No linked pages available (connect first)';
    pageSelect.appendChild(option);
    pageSelect.disabled = true;
    return;
  }

  pageSelect.disabled = false;

  session.pages.forEach((p) => {
    const option = document.createElement('option');
    option.value = p.id;
    option.textContent = p.hasInstagramBusiness
      ? `${p.name} (IG connected)`
      : `${p.name} (no IG business link)`;
    option.selected = session.selectedPage?.id === p.id;
    pageSelect.appendChild(option);
  });
}

async function loadSession() {
  const session = await jsonFetch('/api/session');
  sessionText.textContent = session.connected
    ? `Connected at ${fmt(session.connectedAt)} • token: ${session.tokenType || 'unknown'} • IG user: ${session.igUserId || 'not selected'}`
    : 'Not connected';

  renderPageSelect(session);
}

async function loadDrafts() {
  const drafts = await jsonFetch('/api/drafts');
  draftsList.innerHTML = '';

  if (!drafts.length) {
    draftsList.innerHTML = '<li class="item">No drafts yet.</li>';
    return;
  }

  for (const draft of drafts) {
    const li = document.createElement('li');
    li.className = 'item';
    li.innerHTML = `
      <div><strong>Created:</strong> ${fmt(draft.createdAt)}</div>
      <div><strong>Image:</strong> <a href="${draft.imageUrl}" target="_blank">open</a></div>
      <div><strong>Caption:</strong> ${draft.caption.replaceAll('<', '&lt;')}</div>
      <div class="actions">
        <button data-action="edit" data-id="${draft.id}">Edit</button>
        <button data-action="publish" data-id="${draft.id}">Publish</button>
        <button data-action="delete" data-id="${draft.id}">Delete</button>
      </div>
    `;
    draftsList.appendChild(li);
  }
}

async function loadPosts() {
  postsList.innerHTML = '<li class="item">Loading...</li>';
  try {
    const posts = await jsonFetch('/api/posts');
    postsList.innerHTML = '';

    if (!posts.length) {
      postsList.innerHTML = '<li class="item">No posts found.</li>';
      return;
    }

    for (const p of posts) {
      const li = document.createElement('li');
      li.className = 'item';
      li.innerHTML = `
        <div><strong>${p.media_type}</strong> • ${fmt(p.timestamp)}</div>
        <div>${(p.caption || '').replaceAll('<', '&lt;')}</div>
        <div><a href="${p.permalink}" target="_blank">View on Instagram</a></div>
      `;
      postsList.appendChild(li);
    }
  } catch (err) {
    postsList.innerHTML = `<li class="item">${err.message}</li>`;
  }
}

connectBtn.addEventListener('click', async () => {
  const { url } = await jsonFetch('/api/connect-url');
  window.location.href = url;
});

checkConnectionBtn.addEventListener('click', async () => {
  try {
    const result = await jsonFetch('/api/connection-check');
    alert(`Connected as ${result.me.name}${result.igAccount ? `\nIG username: ${result.igAccount.username}` : ''}`);
  } catch (err) {
    alert(`Connection check failed: ${err.message}`);
  }
});

disconnectBtn.addEventListener('click', async () => {
  await jsonFetch('/api/disconnect', { method: 'POST' });
  await loadSession();
  await loadPosts();
});

pageSelect.addEventListener('change', async () => {
  try {
    await jsonFetch('/api/select-page', {
      method: 'POST',
      body: JSON.stringify({ pageId: pageSelect.value })
    });
    await loadSession();
    await loadPosts();
  } catch (err) {
    alert(err.message);
  }
});

draftForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const caption = document.getElementById('caption').value;
  const imageUrl = document.getElementById('imageUrl').value;

  await jsonFetch('/api/drafts', {
    method: 'POST',
    body: JSON.stringify({ caption, imageUrl })
  });

  draftForm.reset();
  await loadDrafts();
});

draftsList.addEventListener('click', async (e) => {
  const button = e.target.closest('button');
  if (!button) return;

  const id = button.dataset.id;
  const action = button.dataset.action;

  if (action === 'delete') {
    await jsonFetch(`/api/drafts/${id}`, { method: 'DELETE' });
    await loadDrafts();
    return;
  }

  if (action === 'publish') {
    try {
      await jsonFetch(`/api/publish/${id}`, { method: 'POST' });
      await loadDrafts();
      await loadPosts();
      await loadSession();
    } catch (err) {
      alert(err.message);
    }
    return;
  }

  if (action === 'edit') {
    const newCaption = prompt('Update caption:');
    if (newCaption === null) return;
    await jsonFetch(`/api/drafts/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ caption: newCaption })
    });
    await loadDrafts();
  }
});

refreshPostsBtn.addEventListener('click', loadPosts);

showOauthErrorFromUrl();
await loadConfig();
await loadSession();
await loadDrafts();
await loadPosts();
