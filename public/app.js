// ─── State ──────────────────────────────────────────────────────
let token = localStorage.getItem('dv_admin_token');
let currentPage = 'dashboard';

// ─── Init ───────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    if (token) showDashboard();
    const planSelect = document.getElementById('keyPlan');
    if (planSelect) {
        planSelect.addEventListener('change', () => {
            const val = planSelect.value.toLowerCase();
            let dur = 365;
            if (val.includes('demo')) dur = 2; // Default 2 days for Demo
            document.getElementById('keyDuration').value = dur;
        });
    }
});

// ─── Auth ───────────────────────────────────────────────────────
async function doLogin() {
    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;
    const errorEl = document.getElementById('loginError');
    try {
        const res = await api('/api/auth/login', 'POST', { username, password }, false);
        if (res.success) {
            token = res.token;
            localStorage.setItem('dv_admin_token', token);
            showDashboard();
        } else {
            errorEl.textContent = res.message;
            errorEl.classList.remove('hidden');
        }
    } catch (err) {
        errorEl.textContent = 'Connection failed';
        errorEl.classList.remove('hidden');
    }
}

function doLogout() {
    token = null;
    localStorage.removeItem('dv_admin_token');
    document.getElementById('loginScreen').classList.remove('hidden');
    document.getElementById('dashboardScreen').classList.add('hidden');
}

function showDashboard() {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('dashboardScreen').classList.remove('hidden');
    showPage('dashboard');
}

// ─── Navigation ─────────────────────────────────────────────────
function showPage(page) {
    currentPage = page;
    document.querySelectorAll('.nav-item').forEach(el => {
        el.classList.toggle('active', el.dataset.page === page);
    });
    ['dashboard', 'users', 'plans', 'keys', 'licenses', 'posters', 'banners', 'minisites'].forEach(p => {
        const el = document.getElementById('page-' + p);
        if (el) el.classList.toggle('hidden', p !== page);
    });
    // Replay page-in animation for the active page
    const activePage = document.getElementById('page-' + page);
    if (activePage) {
        activePage.style.animation = 'none';
        activePage.offsetHeight; // force reflow
        activePage.style.animation = '';
    }
    switch (page) {
        case 'dashboard': loadDashboard(); break;
        case 'users': loadUsers(); break;
        case 'plans': loadPlans(); break;
        case 'keys': loadKeys(); break;
        case 'licenses': loadLicenses(); break;
        case 'posters': loadPosters(); break;
        case 'banners': loadBanners(); break;
        case 'minisites': loadMiniSites(); break;
    }
}

// ─── Dashboard ──────────────────────────────────────────────────
async function loadDashboard() {
    try {
        const res = await api('/api/dashboard');
        if (!res.success) return;
        const s = res.stats;
        document.getElementById('statsGrid').innerHTML = `
            <div class="stat-card"><div class="stat-icon accent">👥</div><div class="stat-value">${s.totalUsers}</div><div class="stat-label">Total Users</div></div>
            <div class="stat-card"><div class="stat-icon success">✅</div><div class="stat-value">${s.activeUsers}</div><div class="stat-label">Active Users</div></div>
            <div class="stat-card"><div class="stat-icon info">📄</div><div class="stat-value">${s.activeLicenses}</div><div class="stat-label">Active Licenses</div></div>
            <div class="stat-card"><div class="stat-icon danger">⏰</div><div class="stat-value">${s.expiredLicenses}</div><div class="stat-label">Expired</div></div>
            <div class="stat-card"><div class="stat-icon warning">🔑</div><div class="stat-value">${s.unusedKeys}</div><div class="stat-label">Unused Keys</div></div>`;
        const tbody = document.getElementById('recentTable');
        if (!s.recentLicenses.length) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">No activations yet</td></tr>';
        } else {
            tbody.innerHTML = s.recentLicenses.map(l => `<tr>
                <td>${esc(l.username)}</td>
                <td><span class="badge badge-info">${esc(l.plan_name)}</span></td>
                <td>${formatDate(l.expiry_date)}</td>
                <td>${new Date(l.expiry_date) > new Date() ? '<span class="badge badge-success">Active</span>' : '<span class="badge badge-danger">Expired</span>'}</td>
            </tr>`).join('');
        }
    } catch (err) { toast('Failed to load dashboard', 'error'); }
}

// ─── Users ──────────────────────────────────────────────────────
async function loadUsers() {
    try {
        const res = await api('/api/users');
        if (!res.success) return;
        const tbody = document.getElementById('usersTable');
        if (!res.users.length) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted">No users</td></tr>';
        } else {
            tbody.innerHTML = res.users.map(u => {
                const exp = u.license ? formatDate(u.license.expiry_date) : '—';
                const expired = u.license ? new Date(u.license.expiry_date) < new Date() : false;
                return `<tr id="user-row-${u.id}">
                    <td><span class="text-muted">${String(u.id).substring(0, 8)}</span></td>
                    <td><strong>${esc(u.username)}</strong></td>
                    <td id="name-${u.id}">${esc(u.name || '—')}</td>
                    <td id="mobile-${u.id}">${esc(u.mobile || '—')}</td>
                    <td>${u.license ? `<span class="badge badge-info">${esc(u.license.plan_name)}</span>` : '—'}</td>
                    <td>${expired ? `<span class="badge badge-danger">${exp}</span>` : `<span class="badge badge-success">${exp}</span>`}</td>
                    <td>${u.is_active ? '<span class="badge badge-success">Active</span>' : '<span class="badge badge-danger">Inactive</span>'}</td>
                    <td class="gap-2">
                        <button class="btn btn-sm btn-info" onclick="editUser('${u.id}','${esc(u.name || '')}','${esc(u.mobile || '')}')">✏️</button>
                        <button class="btn btn-sm ${u.is_active ? 'btn-warning' : 'btn-success'}" onclick="toggleUser('${u.id}',${!u.is_active})">${u.is_active ? '⏸' : '▶'}</button>
                        <button class="btn btn-sm btn-danger" onclick="deleteUser('${u.id}')">🗑</button>
                    </td></tr>`;
            }).join('');
        }
    } catch (err) { toast('Failed to load users', 'error'); }
}

function editUser(id, currentName, currentMobile) {
    document.getElementById(`name-${id}`).innerHTML = `<input type="text" id="edit-name-${id}" value="${currentName}" placeholder="Name" style="width:100px">`;
    document.getElementById(`mobile-${id}`).innerHTML = `<input type="text" id="edit-mobile-${id}" value="${currentMobile}" placeholder="Mobile" style="width:110px">
        <button class="btn btn-sm btn-success" onclick="saveUser('${id}')" style="margin-left:4px">💾</button>`;
}
async function saveUser(id) {
    const name = document.getElementById(`edit-name-${id}`).value;
    const mobile = document.getElementById(`edit-mobile-${id}`).value;
    const res = await api(`/api/users/${id}`, 'PUT', { name, mobile });
    if (res.success) { toast('User updated', 'success'); loadUsers(); } else toast(res.message, 'error');
}
async function toggleUser(id, newStatus) {
    const res = await api(`/api/users/${id}/status`, 'PUT', { is_active: newStatus });
    if (res.success) { toast(res.message, 'success'); loadUsers(); } else toast(res.message, 'error');
}
async function deleteUser(id) {
    if (!confirm('Delete this user?')) return;
    const res = await api(`/api/users/${id}`, 'DELETE');
    if (res.success) { toast('User deleted', 'success'); loadUsers(); } else toast(res.message, 'error');
}

// ─── Plans ──────────────────────────────────────────────────────
async function loadPlans() {
    try {
        const res = await api('/api/plans');
        if (!res.success) return;
        const tbody = document.getElementById('plansTable');
        if (!res.plans.length) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">No plans yet — create one above</td></tr>';
        } else {
            tbody.innerHTML = res.plans.map(p => {
                const f = p.features || {};
                const features = Object.entries(f).filter(([, v]) => v).map(([k]) => `<span class="badge badge-info">${k}</span>`).join(' ');
                const inactive = Object.entries(f).filter(([, v]) => !v).map(([k]) => `<span class="badge badge-muted">${k}</span>`).join(' ');
                return `<tr>
                    <td><strong>${esc(p.name)}</strong></td>
                    <td>${p.duration_days}d</td>
                    <td>₹${p.price}</td>
                    <td>${features} ${inactive}</td>
                    <td>SMS:${p.max_sms_per_day} WA:${p.max_whatsapp_per_day}</td>
                    <td>${p.is_active ? '<span class="badge badge-success">✓</span>' : '<span class="badge badge-danger">✗</span>'}</td>
                    <td>
                        <button class="btn btn-sm btn-danger" onclick="deletePlan(${p.id})">🗑</button>
                    </td></tr>`;
            }).join('');
        }
        // Update key plan dropdown
        const keyPlanSel = document.getElementById('keyPlan');
        if (keyPlanSel && res.plans.length) {
            keyPlanSel.innerHTML = res.plans.filter(p => p.is_active).map(p =>
                `<option value="${esc(p.name)}">${esc(p.name)} (${p.duration_days}d)</option>`
            ).join('');
        }
    } catch (err) { toast('Failed to load plans', 'error'); }
}

async function savePlan() {
    const name = document.getElementById('planName').value.trim();
    if (!name) return toast('Plan name is required', 'error');
    const features = {
        sms: document.getElementById('feat_sms').checked,
        whatsapp: document.getElementById('feat_whatsapp').checked,
        broadcast: document.getElementById('feat_broadcast').checked,
        minisite: document.getElementById('feat_minisite').checked,
        posters: document.getElementById('feat_posters').checked
    };
    const res = await api('/api/plans', 'POST', {
        name,
        duration_days: parseInt(document.getElementById('planDuration').value) || 30,
        price: parseFloat(document.getElementById('planPrice').value) || 0,
        features,
        max_sms_per_day: parseInt(document.getElementById('planSmsPd').value) || 100,
        max_whatsapp_per_day: parseInt(document.getElementById('planWaPd').value) || 50
    });
    if (res.success) { toast('Plan saved', 'success'); document.getElementById('planName').value = ''; loadPlans(); }
    else toast(res.message, 'error');
}

async function deletePlan(id) {
    if (!confirm('Delete this plan?')) return;
    const res = await api(`/api/plans/${id}`, 'DELETE');
    if (res.success) { toast('Plan deleted', 'success'); loadPlans(); } else toast(res.message, 'error');
}

// Quick Fill Plans helper
function fillPlan(tier) {
    document.getElementById('planName').value = tier;
    
    // Default config object
    const p = { days: 365, p: 0, s: 100, w: 50, f: { sms: true, whatsapp: false, broadcast: false, minisite: false, posters: false} };

    if (tier === 'Demo') {
        p.days = 2; p.p = 0; p.s = 5; p.w = 5;
        p.f = { sms: true, whatsapp: false, broadcast: false, minisite: false, posters: false };
    } else if (tier === 'Basic') {
        p.days = 365; p.p = 500; p.s = 1000; p.w = 500;
        p.f = { sms: true, whatsapp: true, broadcast: false, minisite: false, posters: false };
    } else if (tier === 'Pro') {
        p.days = 365; p.p = 999; p.s = 2000; p.w = 1000;
        p.f = { sms: true, whatsapp: true, broadcast: true, minisite: false, posters: false };
    } else if (tier === 'Premium') {
        p.days = 365; p.p = 2999; p.s = 5000; p.w = 5000;
        p.f = { sms: true, whatsapp: true, broadcast: true, minisite: true, posters: true };
    }

    document.getElementById('planDuration').value = p.days;
    document.getElementById('planPrice').value = p.p;
    document.getElementById('planSmsPd').value = p.s;
    document.getElementById('planWaPd').value = p.w;
    
    document.getElementById('feat_sms').checked = p.f.sms;
    document.getElementById('feat_whatsapp').checked = p.f.whatsapp;
    document.getElementById('feat_broadcast').checked = p.f.broadcast;
    document.getElementById('feat_minisite').checked = p.f.minisite;
    document.getElementById('feat_posters').checked = p.f.posters;
}

// ─── Keys ───────────────────────────────────────────────────────
async function loadKeys() {
    try {
        const res = await api('/api/keys');
        if (!res.success) return;
        const tbody = document.getElementById('keysTable');
        if (!res.keys.length) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted">No keys</td></tr>';
        } else {
            tbody.innerHTML = res.keys.map(k => {
                let status, badge;
                if (k.is_revoked) { status = 'Revoked'; badge = 'badge-danger'; }
                else if (k.is_used) { status = 'Used'; badge = 'badge-warning'; }
                else { status = 'Available'; badge = 'badge-success'; }
                return `<tr>
                    <td><span class="key-value">${esc(k.key_value)}</span></td>
                    <td>${esc(k.plan_name)}</td><td>${k.duration_days}d</td>
                    <td>${k.assigned_username ? esc(k.assigned_username) : '—'}<br>${k.assigned_mobile ? `<small class="text-muted">${esc(k.assigned_mobile)}</small>` : ''}</td>
                    <td><span class="badge ${badge}">${status}</span></td>
                    <td>${k.used_by_username ? esc(k.used_by_username) : '—'}</td>
                    <td>${formatDate(k.created_at)}</td>
                    <td>${!k.is_used && !k.is_revoked ? `<button class="btn btn-sm btn-danger" onclick="revokeKey(${k.id})">Revoke</button>` : '—'}</td>
                </tr>`;
            }).join('');
        }
    } catch (err) { toast('Failed to load keys', 'error'); }
}

async function generateKeys() {
    const count = parseInt(document.getElementById('keyCount').value) || 1;
    const plan_name = document.getElementById('keyPlan').value;
    const duration_days = parseInt(document.getElementById('keyDuration').value) || 30;
    const username = document.getElementById('keyUsername').value.trim();
    const mobile = document.getElementById('keyMobile').value.trim();
    const res = await api('/api/keys/generate', 'POST', { count, plan_name, duration_days, username, mobile });
    if (res.success) { toast(`Generated ${res.keys.length} key(s)`, 'success'); document.getElementById('keyUsername').value = ''; document.getElementById('keyMobile').value = ''; loadKeys(); }
    else toast(res.message, 'error');
}

async function revokeKey(id) {
    if (!confirm('Revoke this key?')) return;
    const res = await api(`/api/keys/${id}/revoke`, 'PUT');
    if (res.success) { toast('Key revoked', 'success'); loadKeys(); } else toast(res.message, 'error');
}

// ─── Licenses ───────────────────────────────────────────────────
async function loadLicenses() {
    try {
        const usersRes = await api('/api/users');
        if (!usersRes.success) return;
        const tbody = document.getElementById('licensesTable');
        const licensed = usersRes.users.filter(u => u.license);
        if (!licensed.length) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No licenses</td></tr>';
        } else {
            tbody.innerHTML = licensed.map(u => {
                const l = u.license;
                const expired = new Date(l.expiry_date) < new Date();
                return `<tr>
                    <td><strong>${esc(u.username)}</strong></td>
                    <td><span class="badge badge-info">${esc(l.plan_name)}</span></td>
                    <td><span class="text-muted">••••${String(u.id).substring(0, 4)}</span></td>
                    <td>${formatDate(l.expiry_date)}</td>
                    <td>${esc(l.payment_status || '—')}</td>
                    <td>${expired ? '<span class="badge badge-danger">Expired</span>' : '<span class="badge badge-success">Active</span>'}</td>
                </tr>`;
            }).join('');
        }
    } catch (err) { toast('Failed to load licenses', 'error'); }
}

// ─── Posters ────────────────────────────────────────────────────
async function loadPosters() {
    try {
        const res = await api('/api/posters');
        if (!res.success) return;
        const grid = document.getElementById('posterGrid');
        if (!res.posters.length) {
            grid.innerHTML = '<p class="text-muted text-center" style="padding:24px">No poster templates yet — upload one above</p>';
        } else {
            grid.innerHTML = res.posters.map(p => `
                <div class="poster-card">
                    <img src="${p.background_url || p.thumbnail_url}" alt="${esc(p.name)}" class="poster-thumb">
                    <div class="poster-info">
                        <strong>${esc(p.name)}</strong>
                        <span class="badge badge-info">${esc(p.category)}</span>
                        <span class="badge ${p.is_active ? 'badge-success' : 'badge-danger'}">${p.is_active ? 'Active' : 'Off'}</span>
                    </div>
                    <div class="poster-actions">
                        <button class="btn btn-sm ${p.is_active ? 'btn-warning' : 'btn-success'}" onclick="togglePoster(${p.id}, ${!p.is_active})">${p.is_active ? '⏸' : '▶'}</button>
                        <button class="btn btn-sm btn-danger" onclick="deletePoster(${p.id})">🗑</button>
                    </div>
                </div>
            `).join('');
        }
    } catch (err) { toast('Failed to load posters', 'error'); }
}

async function uploadPoster() {
    const name = document.getElementById('posterName').value.trim();
    const category = document.getElementById('posterCategory').value;
    const fileInput = document.getElementById('posterFile');
    if (!name || !fileInput.files.length) return toast('Name and image required', 'error');

    const formData = new FormData();
    formData.append('name', name);
    formData.append('category', category);
    formData.append('background', fileInput.files[0]);

    try {
        const opts = { method: 'POST', headers: { 'Authorization': 'Bearer ' + token }, body: formData };
        const res = await fetch('/api/posters', opts).then(r => r.json());
        if (res.success) { toast('Poster uploaded!', 'success'); document.getElementById('posterName').value = ''; fileInput.value = ''; loadPosters(); }
        else toast(res.message, 'error');
    } catch (err) { toast('Upload failed', 'error'); }
}

async function togglePoster(id, newStatus) {
    const res = await api(`/api/posters/${id}`, 'PUT', { is_active: newStatus });
    if (res.success) { toast('Poster updated', 'success'); loadPosters(); } else toast(res.message, 'error');
}

async function deletePoster(id) {
    if (!confirm('Delete this poster?')) return;
    const res = await api(`/api/posters/${id}`, 'DELETE');
    if (res.success) { toast('Poster deleted', 'success'); loadPosters(); } else toast(res.message, 'error');
}

// ─── Banners ────────────────────────────────────────────────────
async function loadBanners() {
    try {
        const res = await api('/api/banners');
        if (!res.success) return;
        const grid = document.getElementById('bannerGrid');
        if (!res.banners.length) {
            grid.innerHTML = '<p class="text-muted text-center" style="padding:24px">No banners yet — upload one above</p>';
        } else {
            grid.innerHTML = res.banners.map(b => `
                <div class="poster-card">
                    <img src="${b.image_url}" alt="${esc(b.title)}" class="poster-thumb">
                    <div class="poster-info">
                        <strong>${esc(b.title)}</strong>
                        <span class="badge ${b.is_active ? 'badge-success' : 'badge-danger'}">${b.is_active ? 'Active' : 'Off'}</span>
                    </div>
                    <div class="poster-actions">
                        <button class="btn btn-sm ${b.is_active ? 'btn-warning' : 'btn-success'}" onclick="toggleBanner(${b.id}, ${!b.is_active})">${b.is_active ? '⏸' : '▶'}</button>
                        <button class="btn btn-sm btn-danger" onclick="deleteBanner(${b.id})">🗑</button>
                    </div>
                </div>
            `).join('');
        }
    } catch (err) { toast('Failed to load banners', 'error'); }
}

async function uploadBanner() {
    const title = document.getElementById('bannerTitle').value.trim();
    const fileInput = document.getElementById('bannerFile');
    if (!title || !fileInput.files.length) return toast('Title and image required', 'error');

    const formData = new FormData();
    formData.append('title', title);
    formData.append('link_url', document.getElementById('bannerLink').value.trim());
    formData.append('image', fileInput.files[0]);

    try {
        const opts = { method: 'POST', headers: { 'Authorization': 'Bearer ' + token }, body: formData };
        const res = await fetch('/api/banners', opts).then(r => r.json());
        if (res.success) { toast('Banner uploaded!', 'success'); document.getElementById('bannerTitle').value = ''; document.getElementById('bannerLink').value = ''; fileInput.value = ''; loadBanners(); }
        else toast(res.message, 'error');
    } catch (err) { toast('Upload failed', 'error'); }
}

async function toggleBanner(id, newStatus) {
    const res = await api(`/api/banners/${id}`, 'PUT', { is_active: newStatus });
    if (res.success) { toast('Banner updated', 'success'); loadBanners(); } else toast(res.message, 'error');
}

async function deleteBanner(id) {
    if (!confirm('Delete this banner?')) return;
    const res = await api(`/api/banners/${id}`, 'DELETE');
    if (res.success) { toast('Banner deleted', 'success'); loadBanners(); } else toast(res.message, 'error');
}

// ─── Mini Sites ─────────────────────────────────────────────────
async function loadMiniSites() {
    try {
        const res = await api('/api/minisite');
        if (!res.success) return;
        const tbody = document.getElementById('minisitesTable');
        const sites = res.sites || [];
        if (!sites.length) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">No mini sites generated yet</td></tr>';
        } else {
            tbody.innerHTML = sites.map(s => `<tr>
                <td><code>${esc(s.slug)}</code></td>
                <td><strong>${esc(s.business_name || s.businessName)}</strong></td>
                <td>${esc(s.phone || '—')}</td>
                <td>${esc(s.whatsapp || '—')}</td>
                <td>${formatDate(s.created_at)}</td>
                <td>
                    <button class="btn btn-sm btn-primary" onclick="openMinisiteEdit('${esc(s.slug)}')">✏️ Edit</button>
                    <a href="/${s.slug}" target="_blank" class="btn btn-sm btn-info" title="promo.mywebz.in/${esc(s.slug)}">🔗 Open</a>
                </td>
            </tr>`).join('');
        }
    } catch (err) { toast('Failed to load mini sites', 'error'); }
}

async function openMinisiteEdit(slug) {
    try {
        const res = await api(`/api/minisite/${slug}`);
        if (!res.success) return toast(res.message, 'error');
        const s = res.site;

        document.getElementById('msModalTitle').textContent = 'Edit';
        document.getElementById('msOldSlug').value = slug;
        document.getElementById('msEditSlug').value = slug;
        document.getElementById('msEditName').value = s.businessName || '';
        document.getElementById('msEditTagline').value = s.tagline || '';
        document.getElementById('msEditPhone').value = s.phone || '';
        document.getElementById('msEditWa').value = s.whatsapp || '';
        document.getElementById('msEditEmail').value = s.email || '';
        document.getElementById('msEditUpi').value = s.upiId || '';
        document.getElementById('msEditAddress').value = s.address || '';
        document.getElementById('msEditMaps').value = s.mapsLink || '';
        document.getElementById('msEditServices').value = s.services || '';

        document.getElementById('msEditLogoFile').value = '';
        document.getElementById('msEditBannerFile').value = '';
        document.getElementById('msGalleryUpload').value = '';

        // Products
        const listDiv = document.getElementById('msProductsList');
        listDiv.innerHTML = '';
        let products = [];
        try { products = typeof s.products === 'string' ? JSON.parse(s.products) : (s.products || []); } catch (e) { }
        if (Array.isArray(products)) {
            products.forEach(p => addMsProductRow(p.name, p.price, p.image_url));
        }

        // Custom Links
        const linksDiv = document.getElementById('msCustomLinksList');
        linksDiv.innerHTML = '';
        let links = [];
        try { links = typeof s.customLinks === 'string' ? JSON.parse(s.customLinks) : (s.customLinks || []); } catch (e) { }
        if (Array.isArray(links)) {
            links.forEach(l => addMsCustomLinkRow(l.title, l.url));
        }

        // Gallery
        const galleryDiv = document.getElementById('msGalleryList');
        galleryDiv.innerHTML = '';
        let gallery = [];
        try { gallery = typeof s.gallery === 'string' ? JSON.parse(s.gallery) : (s.gallery || []); } catch (e) { }
        if (Array.isArray(gallery)) {
            gallery.forEach(imgUrl => addMsGalleryItem(imgUrl));
        }

        document.getElementById('minisiteModal').classList.remove('hidden');
    } catch (err) { toast('Failed to load details', 'error'); }
}

function openMinisiteCreate() {
    document.getElementById('msModalTitle').textContent = 'Create New';
    document.getElementById('msOldSlug').value = '';
    document.getElementById('msEditSlug').value = '';
    document.getElementById('msEditName').value = '';
    document.getElementById('msEditTagline').value = '';
    document.getElementById('msEditPhone').value = '';
    document.getElementById('msEditWa').value = '';
    document.getElementById('msEditEmail').value = '';
    document.getElementById('msEditUpi').value = '';
    document.getElementById('msEditAddress').value = '';
    document.getElementById('msEditMaps').value = '';
    document.getElementById('msEditServices').value = '';

    document.getElementById('msEditLogoFile').value = '';
    document.getElementById('msEditBannerFile').value = '';
    document.getElementById('msGalleryUpload').value = '';

    document.getElementById('msProductsList').innerHTML = '';
    document.getElementById('msCustomLinksList').innerHTML = '';
    document.getElementById('msGalleryList').innerHTML = '';

    document.getElementById('minisiteModal').classList.remove('hidden');
}

function closeMinisiteModal() {
    document.getElementById('minisiteModal').classList.add('hidden');
}

function addMsCustomLinkRow(title = '', url = '') {
    const div = document.createElement('div');
    div.className = 'flex gap-2 items-center';
    div.style = 'display:flex; gap:8px; align-items:flex-end; background:#0D1117; padding:8px; border-radius:6px; border:1px solid #30363D;';
    div.innerHTML = `
        <div style="flex:1;"><label style="font-size:11px;">Title</label><br><input type="text" class="link-title" value="${esc(title)}" placeholder="e.g. Book Appointment" style="width:100%; border:1px solid #30363D; background:#1C212B; color:#fff; padding:4px; border-radius:4px;"></div>
        <div style="flex:2;"><label style="font-size:11px;">URL</label><br><input type="text" class="link-url" value="${esc(url)}" placeholder="https://..." style="width:100%; border:1px solid #30363D; background:#1C212B; color:#fff; padding:4px; border-radius:4px;"></div>
        <button onclick="this.parentElement.remove()" style="background:#FF5252; color:#fff; border:none; padding:6px 10px; border-radius:4px; cursor:pointer;" title="Remove">&times;</button>
    `;
    document.getElementById('msCustomLinksList').appendChild(div);
}

function addMsGalleryItem(url) {
    if (!url) return;
    const div = document.createElement('div');
    div.style = 'position:relative; aspect-ratio:1; border-radius:8px; overflow:hidden; border:1px solid #30363D;';
    div.innerHTML = `
        <img src="${esc(url)}" style="width:100%; height:100%; object-fit:cover;" class="gallery-img-url" data-url="${esc(url)}">
        <button onclick="this.parentElement.remove()" style="position:absolute; top:4px; right:4px; background:rgba(255,82,82,0.9); color:#fff; border:none; width:24px; height:24px; border-radius:12px; cursor:pointer; font-size:12px; display:flex; align-items:center; justify-content:center;">&times;</button>
    `;
    document.getElementById('msGalleryList').appendChild(div);
}

async function handleGalleryUpload(input) {
    const files = input.files;
    if (!files || files.length === 0) return;
    toast(`Uploading ${files.length} images...`, 'info');

    for (let i = 0; i < files.length; i++) {
        const fd = new FormData();
        fd.append('image', files[i]);
        try {
            const res = await fetch('/api/minisite/upload', { method: 'POST', body: fd, headers: { 'Authorization': 'Bearer ' + token } });
            const data = await res.json();
            if (data.success) {
                addMsGalleryItem(data.url);
            }
        } catch (err) {
            console.error(err);
        }
    }
    toast('Gallery upload complete', 'success');
}


function closeMinisiteModal() {
    document.getElementById('minisiteModal').classList.add('hidden');
}

function addMsProductRow(name = '', price = '', imageUrl = '') {
    const div = document.createElement('div');
    div.className = 'flex gap-2 items-center';
    div.style = 'display:flex; gap:8px; align-items:flex-end; background:#0D1117; padding:8px; border-radius:6px; border:1px solid #30363D;';
    div.innerHTML = `
        <div style="flex:2;"><label style="font-size:11px;">Name</label><br><input type="text" class="prod-name" value="${esc(name)}" style="width:100%; border:1px solid #30363D; background:#1C212B; color:#fff; padding:4px; border-radius:4px;"></div>
        <div style="flex:1;"><label style="font-size:11px;">Price</label><br><input type="text" class="prod-price" value="${esc(price)}" placeholder="e.g. 50" style="width:100%; border:1px solid #30363D; background:#1C212B; color:#fff; padding:4px; border-radius:4px;"></div>
        <div style="flex:2;"><label style="font-size:11px;">Image URL</label><br><input type="text" class="prod-img" value="${esc(imageUrl)}" placeholder="https://..." style="width:100%; border:1px solid #30363D; background:#1C212B; color:#fff; padding:4px; border-radius:4px;"></div>
        <button onclick="this.parentElement.remove()" style="background:#FF5252; color:#fff; border:none; padding:6px 10px; border-radius:4px; cursor:pointer;" title="Remove">&times;</button>
    `;
    document.getElementById('msProductsList').appendChild(div);
}

async function saveMinisiteEdits() {
    const btn = document.getElementById('btnSaveMsEdit');
    btn.disabled = true;
    btn.textContent = 'Uploading...';

    try {
        const oldSlug = document.getElementById('msOldSlug').value.trim();
        const slug = document.getElementById('msEditSlug').value.trim();
        const businessName = document.getElementById('msEditName').value;
        const tagline = document.getElementById('msEditTagline').value;
        const phone = document.getElementById('msEditPhone').value;
        const whatsapp = document.getElementById('msEditWa').value;
        const email = document.getElementById('msEditEmail').value;
        const upiId = document.getElementById('msEditUpi').value;
        const address = document.getElementById('msEditAddress').value;
        const mapsLink = document.getElementById('msEditMaps').value;
        const services = document.getElementById('msEditServices').value;

        let logoUrl = undefined;
        let bannerUrl = undefined;

        // Upload logo if exists
        const logoFile = document.getElementById('msEditLogoFile').files[0];
        if (logoFile) {
            const fd = new FormData();
            fd.append('image', logoFile);
            const res = await fetch('/api/minisite/upload', { method: 'POST', body: fd, headers: { 'Authorization': 'Bearer ' + token } });
            const data = await res.json();
            if (data.success) logoUrl = data.url;
        }

        // Upload banner if exists
        const bannerFile = document.getElementById('msEditBannerFile').files[0];
        if (bannerFile) {
            const fd = new FormData();
            fd.append('image', bannerFile);
            const res = await fetch('/api/minisite/upload', { method: 'POST', body: fd, headers: { 'Authorization': 'Bearer ' + token } });
            const data = await res.json();
            if (data.success) bannerUrl = data.url;
        }

        // Collect Products
        const products = [];
        const rows = document.getElementById('msProductsList').children;
        for (let i = 0; i < rows.length; i++) {
            const name = rows[i].querySelector('.prod-name').value.trim();
            const price = rows[i].querySelector('.prod-price').value.trim();
            const img = rows[i].querySelector('.prod-img').value.trim();
            if (name) {
                products.push({ name, price, image_url: img });
            }
        }

        // Collect Custom Links
        const customLinks = [];
        const linkRows = document.getElementById('msCustomLinksList').children;
        for (let i = 0; i < linkRows.length; i++) {
            const title = linkRows[i].querySelector('.link-title').value.trim();
            const url = linkRows[i].querySelector('.link-url').value.trim();
            if (title && url) {
                customLinks.push({ title, url });
            }
        }

        // Collect Gallery
        const gallery = [];
        const galleryImages = document.querySelectorAll('.gallery-img-url');
        galleryImages.forEach(img => {
            const url = img.getAttribute('data-url');
            if (url) gallery.push(url);
        });

        btn.textContent = 'Saving...';

        const payload = {
            oldSlug, slug,
            businessName, tagline, phone, whatsapp, email,
            address, mapsLink, services, upiId,
            products: JSON.stringify(products),
            customLinks: JSON.stringify(customLinks),
            gallery: JSON.stringify(gallery)
        };

        // Fetch existing URLs if no new files were uploaded
        if (oldSlug && (!logoFile || !bannerFile)) {
            const res = await api(`/api/minisite/${oldSlug}`);
            if (res.success) {
                if (!logoFile && res.site.logoUrl) payload.logoUrl = res.site.logoUrl;
                if (!bannerFile && res.site.bannerUrl) payload.bannerUrl = res.site.bannerUrl;
            }
        }

        if (logoFile && logoUrl) payload.logoUrl = logoUrl;
        if (bannerFile && bannerUrl) payload.bannerUrl = bannerUrl;

        const saveRes = await api('/api/minisite', 'POST', payload, false);

        if (saveRes.success) {
            toast('Mini Site updated successfully!');
            closeMinisiteModal();
            loadMiniSites();
        } else {
            toast(saveRes.message, 'error');
        }
    } catch (err) {
        toast('Failed to save edits', 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = '💾 Save Changes';
    }
}

// ─── API Helper ─────────────────────────────────────────────────
async function api(url, method = 'GET', body = null, auth = true) {
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    if (auth && token) opts.headers['Authorization'] = 'Bearer ' + token;
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(url, opts);
    if (res.status === 401 && auth) { doLogout(); toast('Session expired', 'error'); throw new Error('Unauthorized'); }
    return res.json();
}

// ─── Utilities ──────────────────────────────────────────────────
function esc(str) { if (!str) return ''; const el = document.createElement('span'); el.textContent = str; return el.innerHTML; }
function formatDate(d) { if (!d) return '—'; return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
function toast(msg, type = 'success') {
    const c = document.getElementById('toastContainer');
    const el = document.createElement('div');
    el.className = 'toast ' + type;
    el.innerHTML = `${type === 'success' ? '✅' : '❌'} ${esc(msg)}`;
    c.appendChild(el);
    setTimeout(() => el.remove(), 4000);
}
