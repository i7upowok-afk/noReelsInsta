const connectForm = document.getElementById('connect-form');
const checkConnectionBtn = document.getElementById('check-connection');
const disconnectBtn = document.getElementById('disconnect-btn');
const sessionText = document.getElementById('session-text');
const draftForm = document.getElementById('draft-form');
const draftsList = document.getElementById('drafts');
const postsList = document.getElementById('posts');
const refreshPostsBtn = document.getElementById('refresh-posts');

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

async function loadSession() {
  const session = await jsonFetch('/api/session');
  sessionText.textContent = session.connected
    ? `Connected profile: @${session.instagramUsername} (${session.instagramUrl}) • connected at ${fmt(session.connectedAt)} • publishing ready: ${session.publishingReady ? 'yes' : 'no'}`
    : 'Not connected';

  if (session.instagramUrl) {
    document.getElementById('instagramUrl').value = session.instagramUrl;
  }

  if (session.igUserId) {
    document.getElementById('igUserId').value = session.igUserId;
  }
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

connectForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await jsonFetch('/api/connect-instagram', {
      method: 'POST',
      body: JSON.stringify({
        instagramUrl: document.getElementById('instagramUrl').value,
        accessToken: document.getElementById('accessToken').value,
        igUserId: document.getElementById('igUserId').value
      })
    });

    await loadSession();
    alert('Instagram URL connected.');
  } catch (err) {
    alert(err.message);
  }
});

checkConnectionBtn.addEventListener('click', async () => {
  try {
    const result = await jsonFetch('/api/connection-check');
    alert(`API connection is valid for @${result.igAccount.username} (${result.igAccount.account_type})`);
  } catch (err) {
    alert(`Connection check failed: ${err.message}`);
  }
});

disconnectBtn.addEventListener('click', async () => {
  await jsonFetch('/api/disconnect', { method: 'POST' });
  document.getElementById('accessToken').value = '';
  document.getElementById('igUserId').value = '';
  await loadSession();
  await loadPosts();
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

await loadSession();
await loadDrafts();
await loadPosts();
