const connectForm = document.getElementById('connect-form');
const disconnectBtn = document.getElementById('disconnect-btn');
const sessionText = document.getElementById('session-text');
const draftForm = document.getElementById('draft-form');
const draftsList = document.getElementById('drafts');
const postsList = document.getElementById('posts');
const refreshPostsBtn = document.getElementById('refresh-posts');
const profileCard = document.getElementById('profile-card');
const profilePic = document.getElementById('profile-pic');
const profileName = document.getElementById('profile-name');
const profileUsername = document.getElementById('profile-username');

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

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Failed to read selected image file.'));
    reader.readAsDataURL(file);
  });
}

function renderProfile(session) {
  if (session.connected && session.profilePictureUrl) {
    profileCard.classList.remove('hidden');
    profilePic.src = session.profilePictureUrl;
    profileName.textContent = session.displayName || session.instagramUsername;
    profileUsername.textContent = `@${session.instagramUsername}`;
  } else {
    profileCard.classList.add('hidden');
    profilePic.removeAttribute('src');
    profileName.textContent = '';
    profileUsername.textContent = '';
  }
}

async function loadSession() {
  const session = await jsonFetch('/api/session');
  sessionText.textContent = session.connected
    ? `Connected at ${fmt(session.connectedAt)}.`
    : 'Not connected';

  if (session.instagramUrl) {
    document.getElementById('instagramUrl').value = session.instagramUrl;
  }

  renderProfile(session);
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
      <img class="draft-thumb" src="${draft.imageDataUrl}" alt="Draft image preview" />
      <div><strong>Created:</strong> ${fmt(draft.createdAt)}</div>
      <div><strong>Caption:</strong> ${draft.caption.replaceAll('<', '&lt;')}</div>
      <div class="actions">
        <button data-action="edit" data-id="${draft.id}">Edit Caption</button>
        <button data-action="delete" data-id="${draft.id}">Delete</button>
      </div>
    `;
    draftsList.appendChild(li);
  }
}

async function loadPosts() {
  const posts = await jsonFetch('/api/posts');
  postsList.innerHTML = posts.length
    ? posts.map((p) => `<li class="item">${p.caption || 'Post'}</li>`).join('')
    : '<li class="item">Publishing not configured in URL-only mode.</li>';
}

connectForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await jsonFetch('/api/connect-instagram', {
      method: 'POST',
      body: JSON.stringify({
        instagramUrl: document.getElementById('instagramUrl').value
      })
    });

    await loadSession();
    alert('Instagram account connected.');
  } catch (err) {
    alert(err.message);
  }
});

disconnectBtn.addEventListener('click', async () => {
  await jsonFetch('/api/disconnect', { method: 'POST' });
  await loadSession();
});

draftForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const caption = document.getElementById('caption').value;
  const file = document.getElementById('imageFile').files[0];

  if (!file) {
    alert('Please choose an image file.');
    return;
  }

  const imageDataUrl = await readFileAsDataUrl(file);

  await jsonFetch('/api/drafts', {
    method: 'POST',
    body: JSON.stringify({ caption, imageDataUrl })
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
