// ===== 비번 게이트 =====
const SITE_PASSWORD = "ridal0629";  // 비번 변경시 이 줄만 수정
const gate = document.getElementById('gate');
const gateInput = document.getElementById('gate-input');
const gateBtn = document.getElementById('gate-btn');
const gateError = document.getElementById('gate-error');

function checkGate() {
  if (sessionStorage.getItem('sudal_unlocked') === '1') {
    gate.classList.add('hidden');
  }
}
function tryUnlock() {
  if (gateInput.value === SITE_PASSWORD) {
    sessionStorage.setItem('sudal_unlocked', '1');
    gate.classList.add('hidden');
    gateError.textContent = '';
  } else {
    gateError.textContent = '비밀번호가 틀렸어요';
    gateInput.value = '';
  }
}
gateBtn.addEventListener('click', tryUnlock);
gateInput.addEventListener('keydown', e => { if (e.key === 'Enter') tryUnlock(); });
checkGate();

// ===== Supabase 연결 (전시회용) =====
const SUPABASE_URL = "https://hhtaoecylurpmfkrmqfj.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhodGFvZWN5bHVycG1ma3JtcWZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2NDU4MjQsImV4cCI6MjA5ODIyMTgyNH0.8SEqkGjALSLWUx4chnzuRqct0fIqe507mPazO5KLO04";
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const BUCKET = 'gallery-images';

// ===== 데이터 =====
const ARTISTS = window.SUDAL_ARTISTS || [];
let POSTS = [];               // 전시회는 Supabase에서 실시간 로드
let postEditingId = null;     // 수정 중인 글 id
let pfUploadedUrls = [];      // 폼에서 업로드된 이미지 URL들

// ===== 탭 전환 =====
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');
  });
});

// ===== 작가 섹션 (기존 그대로) =====
let artistFilter = { search: '', tag: null };

function renderArtists() {
  const grid = document.getElementById('artist-grid');
  const filtered = ARTISTS.filter(a => {
    const q = artistFilter.search.toLowerCase();
    const matchSearch = !q ||
      (a.name && a.name.toLowerCase().includes(q)) ||
      (a.comment && a.comment.toLowerCase().includes(q));
    const matchTag = !artistFilter.tag || (a.tags || []).includes(artistFilter.tag);
    return matchSearch && matchTag;
  });

  document.getElementById('artist-count').textContent = filtered.length;
  grid.innerHTML = filtered.map(a => `
    <div class="card" data-id="${a.id}" data-type="artist">
      <div class="card-img">
        ${a.thumbnail ? `<img src="${a.thumbnail}" loading="lazy" alt="">` : ''}
      </div>
      <div class="card-body">
        <div class="card-title">${escapeHtml(a.name)}</div>
        <div class="card-meta">${a.image_count}개</div>
        <div class="card-tags">
          ${(a.tags || []).slice(0, 3).map(t => `<span class="card-tag">${escapeHtml(t)}</span>`).join('')}
        </div>
      </div>
    </div>
  `).join('');
}

function renderArtistTags() {
  const allTags = new Set();
  ARTISTS.forEach(a => (a.tags || []).forEach(t => allTags.add(t)));
  const container = document.getElementById('artist-tag-filter');
  container.innerHTML = `<button class="${!artistFilter.tag ? 'active' : ''}" data-tag="">전체</button>` +
    [...allTags].sort().map(t =>
      `<button class="${artistFilter.tag === t ? 'active' : ''}" data-tag="${escapeHtml(t)}">${escapeHtml(t)}</button>`
    ).join('');
  container.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      artistFilter.tag = btn.dataset.tag || null;
      renderArtistTags();
      renderArtists();
    });
  });
}

document.getElementById('artist-search').addEventListener('input', e => {
  artistFilter.search = e.target.value;
  renderArtists();
});

// ===== 전시회 섹션 (Supabase 동적) =====
let postFilter = { search: '' };

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function loadPosts() {
  const loading = document.getElementById('post-loading');
  loading.style.display = 'block';
  loading.textContent = '불러오는 중…';
  const { data, error } = await sb
    .from('posts')
    .select('*')
    .eq('is_deleted', false)
    .order('created_at', { ascending: false });
  loading.style.display = 'none';
  if (error) {
    loading.style.display = 'block';
    loading.textContent = '불러오기 실패: ' + error.message;
    console.error(error);
    return;
  }
  POSTS = data || [];
  renderPosts();
}

function postThumb(p) {
  if (p.image_urls && p.image_urls.length) {
    return p.image_urls[p.thumbnail_index || 0] || p.image_urls[0];
  }
  return p.image_url || '';
}

function renderPosts() {
  const grid = document.getElementById('post-grid');
  const filtered = POSTS.filter(p => {
    const q = postFilter.search.toLowerCase();
    return !q ||
      (p.title && p.title.toLowerCase().includes(q)) ||
      (p.content && p.content.toLowerCase().includes(q)) ||
      (p.memo && p.memo.toLowerCase().includes(q)) ||
      (p.tags && p.tags.toLowerCase().includes(q));
  });
  document.getElementById('post-count').textContent = filtered.length;
  grid.innerHTML = filtered.map(p => {
    const thumb = postThumb(p);
    return `
    <div class="card" data-id="${p.id}" data-type="post">
      <div class="card-img">
        ${thumb ? `<img src="${thumb}" loading="lazy" alt="">` : ''}
      </div>
      <div class="card-body">
        <div class="card-title">${escapeHtml(p.title)}</div>
        <div class="card-meta">${formatDate(p.created_at)} · ${escapeHtml(p.nickname || '')}</div>
      </div>
    </div>`;
  }).join('');
}

document.getElementById('post-search').addEventListener('input', e => {
  postFilter.search = e.target.value;
  renderPosts();
});

// ===== 이미지 업로드 (전시회 폼) =====
async function uploadFile(file) {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const safeName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await sb.storage.from(BUCKET).upload(safeName, file, {
    cacheControl: '3600', upsert: false,
  });
  if (error) throw error;
  const { data } = sb.storage.from(BUCKET).getPublicUrl(safeName);
  return data.publicUrl;
}

function renderPfPreview() {
  const box = document.getElementById('pf-preview');
  box.innerHTML = pfUploadedUrls.map((url, i) =>
    `<div style="position:relative">
       <img src="${url}" alt="">
       <button type="button" onclick="removePfImage(${i})"
         style="position:absolute;top:2px;right:2px;background:rgba(0,0,0,0.6);color:#fff;border:none;border-radius:50%;width:22px;height:22px;cursor:pointer;font-size:12px">✕</button>
     </div>`
  ).join('');
}

window.removePfImage = function(i) {
  pfUploadedUrls.splice(i, 1);
  renderPfPreview();
};

document.getElementById('pf-files').addEventListener('change', async (e) => {
  const files = Array.from(e.target.files);
  if (!files.length) return;
  const status = document.getElementById('pf-upload-status');
  document.getElementById('pf-submit').disabled = true;
  for (let i = 0; i < files.length; i++) {
    status.textContent = `업로드 중… (${i + 1}/${files.length})`;
    try {
      const url = await uploadFile(files[i]);
      pfUploadedUrls.push(url);
      renderPfPreview();
    } catch (err) {
      status.textContent = '업로드 실패: ' + err.message;
      document.getElementById('pf-submit').disabled = false;
      return;
    }
  }
  status.textContent = `✓ ${files.length}장 업로드 완료`;
  e.target.value = '';
  document.getElementById('pf-submit').disabled = false;
});

// ===== 전시회 폼 열기/닫기 =====
const postFormModal = document.getElementById('post-form-modal');

document.getElementById('new-post-btn').addEventListener('click', () => {
  postEditingId = null;
  pfUploadedUrls = [];
  document.getElementById('post-form-title').textContent = '새 글 작성';
  document.getElementById('pf-title').value = '';
  document.getElementById('pf-nickname').value = '';
  document.getElementById('pf-tags').value = '';
  document.getElementById('pf-memo').value = '';
  document.getElementById('pf-pw').value = '';
  document.getElementById('pf-upload-status').textContent = '';
  renderPfPreview();
  document.getElementById('pf-pw-label').textContent = '비밀번호 * (나중에 수정/삭제할 때 필요)';
  document.getElementById('pf-pw-hint').textContent = '이 비번을 알아야 나중에 이 글을 수정/삭제할 수 있어요.';
  document.getElementById('pf-error').textContent = '';
  postFormModal.classList.remove('hidden');
});

window.startPostEdit = function(id) {
  const p = POSTS.find(x => x.id === id);
  if (!p) return;
  postEditingId = id;
  pfUploadedUrls = [...(p.image_urls || [])];
  document.getElementById('post-form-title').textContent = '글 수정';
  document.getElementById('pf-title').value = p.title || '';
  document.getElementById('pf-nickname').value = p.nickname || '';
  document.getElementById('pf-tags').value = p.tags || '';
  document.getElementById('pf-memo').value = p.memo || '';
  document.getElementById('pf-pw').value = '';
  document.getElementById('pf-upload-status').textContent = '';
  renderPfPreview();
  document.getElementById('pf-pw-label').textContent = '비밀번호 * (작성 시 정한 비번)';
  document.getElementById('pf-pw-hint').textContent = '이 글을 작성할 때 정한 비번을 입력하세요.';
  document.getElementById('pf-error').textContent = '';
  modal.classList.add('hidden');
  postFormModal.classList.remove('hidden');
};

document.querySelectorAll('[data-close-form]').forEach(el =>
  el.addEventListener('click', () => postFormModal.classList.add('hidden')));

// ===== 전시회 저장 (추가/수정) =====
document.getElementById('pf-submit').addEventListener('click', async () => {
  const errBox = document.getElementById('pf-error');
  errBox.textContent = '';
  const title = document.getElementById('pf-title').value.trim();
  const nickname = document.getElementById('pf-nickname').value.trim();
  const tags = document.getElementById('pf-tags').value.trim();
  const memo = document.getElementById('pf-memo').value.trim();
  const pw = document.getElementById('pf-pw').value;

  if (!title) { errBox.textContent = '제목을 입력하세요.'; return; }
  if (!pw) { errBox.textContent = '비밀번호를 입력하세요.'; return; }

  const image_urls = [...pfUploadedUrls];
  const pwHash = await sha256(pw);
  document.getElementById('pf-submit').disabled = true;

  if (postEditingId === null) {
    const { error } = await sb.from('posts').insert([{
      title, nickname, password_hash: pwHash,
      image_url: image_urls[0] || null,
      image_urls, tags, memo,
      thumbnail_index: 0, is_deleted: false
    }]);
    if (error) { errBox.textContent = '저장 실패: ' + error.message; }
    else { postFormModal.classList.add('hidden'); await loadPosts(); }
  } else {
    const p = POSTS.find(x => x.id === postEditingId);
    if (p.password_hash && p.password_hash !== pwHash) {
      errBox.textContent = '비밀번호가 틀렸어요.';
      document.getElementById('pf-submit').disabled = false;
      return;
    }
    const { error } = await sb.from('posts').update({
      title, nickname,
      image_url: image_urls[0] || null,
      image_urls, tags, memo
    }).eq('id', postEditingId);
    if (error) { errBox.textContent = '수정 실패: ' + error.message; }
    else { postFormModal.classList.add('hidden'); await loadPosts(); }
  }
  document.getElementById('pf-submit').disabled = false;
});

// ===== 전시회 삭제 (soft delete) =====
window.startPostDelete = async function(id) {
  const p = POSTS.find(x => x.id === id);
  if (!p) return;
  const pw = prompt('삭제하려면 이 글의 비밀번호를 입력하세요:');
  if (pw === null) return;
  const pwHash = await sha256(pw);
  if (p.password_hash && p.password_hash !== pwHash) {
    alert('비밀번호가 틀렸어요.');
    return;
  }
  const { error } = await sb.from('posts').update({ is_deleted: true }).eq('id', id);
  if (error) { alert('삭제 실패: ' + error.message); }
  else { modal.classList.add('hidden'); await loadPosts(); }
};

// ===== 모달 (카드 클릭) =====
const modal = document.getElementById('modal');
const modalBody = document.getElementById('modal-body');

document.addEventListener('click', e => {
  const card = e.target.closest('.card');
  if (card) {
    const id = card.dataset.id;
    const type = card.dataset.type;
    if (type === 'artist') showArtistModal(id);
    else if (type === 'post') showPostModal(id);
  }
});

function showArtistModal(id) {
  const a = ARTISTS.find(x => x.id === id);
  if (!a) return;
  modalBody.innerHTML = `
    <h2>${escapeHtml(a.name)}</h2>
    <div class="modal-meta">그림 ${a.image_count}개 ${a.artist_link ? `· <a href="${a.artist_link}" target="_blank">링크</a>` : ''}</div>

    ${a.tags && a.tags.length ? `
      <div class="modal-section">
        <h3>그림체</h3>
        <div class="modal-tags">${a.tags.map(t => `<span class="modal-tag">${escapeHtml(t)}</span>`).join('')}</div>
      </div>
    ` : ''}

    ${a.artist_images.length ? `
      <div class="modal-section">
        <h3>작가 그림</h3>
        <div class="image-grid">${a.artist_images.map((src, i) => `<img src="${src}" loading="lazy" data-gallery="artist" data-idx="${i}" alt="">`).join('')}</div>
      </div>
    ` : ''}

    ${a.reference_images.length ? `
      <div class="modal-section">
        <h3>참고 그림</h3>
        <div class="image-grid">${a.reference_images.map((src, i) => `<img src="${src}" loading="lazy" data-gallery="reference" data-idx="${i}" alt="">`).join('')}</div>
      </div>
    ` : ''}

    ${a.comment ? `
      <div class="modal-section">
        <h3>코멘트</h3>
        <div class="modal-text">${escapeHtml(a.comment)}</div>
      </div>
    ` : ''}
  `;
  currentGallery = { artist: a.artist_images, reference: a.reference_images };
  modal.classList.remove('hidden');
}

function showPostModal(id) {
  const p = POSTS.find(x => x.id === id);
  if (!p) return;
  const imgs = (p.image_urls && p.image_urls.length) ? p.image_urls : (p.image_url ? [p.image_url] : []);
  modalBody.innerHTML = `
    <h2>${escapeHtml(p.title)}</h2>
    <div class="modal-meta">${escapeHtml(p.nickname || '')} · ${formatDate(p.created_at)}</div>

    ${imgs.length ? `
      <div class="modal-section">
        <h3>이미지 (${imgs.length}장)</h3>
        <div class="image-grid">${imgs.map((src, i) => `<img src="${src}" loading="lazy" data-gallery="post" data-idx="${i}" alt="">`).join('')}</div>
      </div>
    ` : ''}

    ${p.tags ? `
      <div class="modal-section">
        <h3>태그 (복사용)</h3>
        <div class="modal-text">${escapeHtml(p.tags)}</div>
      </div>
    ` : ''}

    ${p.memo ? `
      <div class="modal-section">
        <h3>메모</h3>
        <div class="modal-text">${escapeHtml(p.memo)}</div>
      </div>
    ` : ''}

    ${p.content ? `
      <div class="modal-section">
        <h3>내용</h3>
        <div class="modal-text">${escapeHtml(p.content)}</div>
      </div>
    ` : ''}

    <div class="modal-actions">
      <button class="btn-ghost" onclick="startPostEdit('${p.id}')">수정</button>
      <button class="btn-danger" onclick="startPostDelete('${p.id}')">삭제</button>
    </div>
  `;
  currentGallery = { post: imgs };
  modal.classList.remove('hidden');
}

document.querySelector('.modal-close').addEventListener('click', () => modal.classList.add('hidden'));
document.querySelector('.modal-bg').addEventListener('click', () => modal.classList.add('hidden'));

// ===== 라이트박스 =====
let currentGallery = {};
let lbList = [];
let lbIdx = 0;
const lightbox = document.getElementById('lightbox');
const lbImg = document.getElementById('lb-img');

modalBody.addEventListener('click', e => {
  if (e.target.tagName === 'IMG' && e.target.dataset.gallery) {
    lbList = currentGallery[e.target.dataset.gallery] || [];
    lbIdx = parseInt(e.target.dataset.idx) || 0;
    showLb();
  }
});

function showLb() {
  lbImg.src = lbList[lbIdx];
  document.getElementById('lb-current').textContent = lbIdx + 1;
  document.getElementById('lb-total').textContent = lbList.length;
  lightbox.classList.remove('hidden');
}

document.querySelector('.lb-close').addEventListener('click', () => lightbox.classList.add('hidden'));
document.querySelector('.lb-prev').addEventListener('click', () => { lbIdx = (lbIdx - 1 + lbList.length) % lbList.length; showLb(); });
document.querySelector('.lb-next').addEventListener('click', () => { lbIdx = (lbIdx + 1) % lbList.length; showLb(); });

document.addEventListener('keydown', e => {
  if (!lightbox.classList.contains('hidden')) {
    if (e.key === 'Escape') lightbox.classList.add('hidden');
    if (e.key === 'ArrowLeft') document.querySelector('.lb-prev').click();
    if (e.key === 'ArrowRight') document.querySelector('.lb-next').click();
  } else if (!postFormModal.classList.contains('hidden')) {
    if (e.key === 'Escape') postFormModal.classList.add('hidden');
  } else if (!modal.classList.contains('hidden')) {
    if (e.key === 'Escape') modal.classList.add('hidden');
  }
});

// ===== 유틸 =====
function escapeHtml(s) {
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function formatDate(s) {
  if (!s) return '';
  return s.substring(0, 10).replace(/-/g, '.');
}

// ===== 초기 렌더 =====
renderArtistTags();
renderArtists();
loadPosts();  // 전시회는 Supabase에서 로드
