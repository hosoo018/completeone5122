// ===== 데이터 로드 =====
const POSTS = window.SUDAL_POSTS || [];
const ARTISTS = window.SUDAL_ARTISTS || [];

// ===== 탭 전환 =====
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');
  });
});

// ===== 작가 섹션 =====
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

// ===== 전시회 섹션 =====
let postFilter = { search: '' };

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
  grid.innerHTML = filtered.map(p => `
    <div class="card" data-id="${p.id}" data-type="post">
      <div class="card-img">
        ${p.images[0] ? `<img src="${p.images[0]}" loading="lazy" alt="">` : ''}
      </div>
      <div class="card-body">
        <div class="card-title">${escapeHtml(p.title)}</div>
        <div class="card-meta">${formatDate(p.created_at)} · ${p.nickname || ''}</div>
      </div>
    </div>
  `).join('');
}

document.getElementById('post-search').addEventListener('input', e => {
  postFilter.search = e.target.value;
  renderPosts();
});

// ===== 모달 =====
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
  modalBody.innerHTML = `
    <h2>${escapeHtml(p.title)}</h2>
    <div class="modal-meta">${escapeHtml(p.nickname || '')} · ${formatDate(p.created_at)}</div>

    ${p.images.length ? `
      <div class="modal-section">
        <h3>이미지 (${p.images.length}장)</h3>
        <div class="image-grid">${p.images.map((src, i) => `<img src="${src}" loading="lazy" data-gallery="post" data-idx="${i}" alt="">`).join('')}</div>
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
  `;
  currentGallery = { post: p.images };
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
renderPosts();
