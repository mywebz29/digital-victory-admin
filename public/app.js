// ─── State ──────────────────────────────────────────────────────
let token = localStorage.getItem('dv_admin_token');
let currentPage = 'dashboard';

// ─── Init ───────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    if (token) {
        showDashboard();
    }
    // Auto-update plan duration when plan changes
    const planSelect = document.getElementById('keyPlan');
    if (planSelect) {
        planSelect.addEventListener('change', () => {
            const dur = { Basic: 30, Pro: 90, Premium: 365 };
            document.getElementById('keyDuration').value = dur[planSelect.value] || 30;
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
    // Toggle nav items
    document.querySelectorAll('.nav-item').forEach(el => {
        el.classList.toggle('active', el.dataset.page === page);
    });
    // Toggle page sections
    ['dashboard', 'users', 'keys', 'licenses'].forEach(p => {
        const el = document.getElementById('page-' + p);
        if (el) el.classList.toggle('hidden', p !== page);
    });
    // Load data
    switch (page) {
        case 'dashboard': loadDashboard(); break;
        case 'users': loadUsers(); break;
        case 'keys': loadKeys(); break;
        case 'licenses': loadLicenses(); break;
    }
}

// ─── Dashboard ──────────────────────────────────────────────────
async function loadDashboard() {
    try {
        const res = await api('/api/dashboard');
        if (!res.success) return;
        const s = res.stats;

        document.getElementById('statsGrid').innerHTML = `
            <div class="stat-card">
                <div class="stat-icon accent">👥</div>
                <div class="stat-value">${s.totalUsers}</div>
                <div class="stat-label">Total Users</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon success">✅</div>
                <div class="stat-value">${s.activeUsers}</div>
                <div class="stat-label">Active Users</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon info">📄</div>
                <div class="stat-value">${s.activeLicenses}</div>
                <div class="stat-label">Active Licenses</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon danger">⏰</div>
                <div class="stat-value">${s.expiredLicenses}</div>
                <div class="stat-label">Expired Licenses</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon warning">🔑</div>
                <div class="stat-value">${s.unusedKeys}</div>
                <div class="stat-label">Unused Keys</div>
            </div>
        `;

        const tbody = document.getElementById('recentTable');
        if (s.recentLicenses.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">No activations yet</td></tr>';
        } else {
            tbody.innerHTML = s.recentLicenses.map(l => `
                <tr>
                    <td>${esc(l.username)}</td>
                    <td><span class="badge badge-info">${esc(l.plan_name)}</span></td>
                    <td>${formatDate(l.expiry_date)}</td>
                    <td>${new Date(l.expiry_date) > new Date()
                    ? '<span class="badge badge-success">Active</span>'
                    : '<span class="badge badge-danger">Expired</span>'}</td>
                </tr>
            `).join('');
        }
    } catch (err) {
        toast('Failed to load dashboard', 'error');
    }
}

// ─── Users ──────────────────────────────────────────────────────
async function loadUsers() {
    try {
        const res = await api('/api/users');
        if (!res.success) return;

        const tbody = document.getElementById('usersTable');
        if (res.users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="10" class="text-center text-muted">No users registered yet</td></tr>';
        } else {
            tbody.innerHTML = res.users.map(u => {
                const expiryDate = u.license ? formatDate(u.license.expiry_date) : '—';
                const isExpired = u.license ? new Date(u.license.expiry_date) < new Date() : false;
                return `
                    <tr id="user-row-${u.id}">
                        <td>${u.id}</td>
                        <td><strong>${esc(u.username)}</strong></td>
                        <td id="name-${u.id}">${esc(u.name || '—')}</td>
                        <td id="mobile-${u.id}">${esc(u.mobile || '—')}</td>
                        <td><span class="text-muted">${esc(u.device_id || '—')}</span></td>
                        <td>${u.license ? `<span class="badge badge-info">${esc(u.license.plan_name)}</span>` : '<span class="text-muted">—</span>'}</td>
                        <td>${isExpired
                        ? `<span class="badge badge-danger">${expiryDate}</span>`
                        : `<span class="badge badge-success">${expiryDate}</span>`}</td>
                        <td>${u.is_active
                        ? '<span class="badge badge-success">Active</span>'
                        : '<span class="badge badge-danger">Inactive</span>'}</td>
                        <td>${formatDate(u.created_at)}</td>
                        <td class="gap-2">
                            <button class="btn btn-sm btn-info" onclick="editUser(${u.id}, '${esc(u.name || '')}', '${esc(u.mobile || '')}')">✏️</button>
                            <button class="btn btn-sm ${u.is_active ? 'btn-warning' : 'btn-success'}"
                                    onclick="toggleUser(${u.id}, ${!u.is_active})">
                                ${u.is_active ? '⏸' : '▶'}
                            </button>
                            <button class="btn btn-sm btn-danger" onclick="deleteUser(${u.id})">🗑</button>
                        </td>
                    </tr>
                `;
            }).join('');
        }
    } catch (err) {
        toast('Failed to load users', 'error');
    }
}

function editUser(id, currentName, currentMobile) {
    document.getElementById(`name-${id}`).innerHTML = `<input type="text" id="edit-name-${id}" value="${currentName}" placeholder="Name" style="width:100px">`;
    document.getElementById(`mobile-${id}`).innerHTML = `<input type="text" id="edit-mobile-${id}" value="${currentMobile}" placeholder="Mobile" style="width:110px">
        <button class="btn btn-sm btn-success" onclick="saveUser(${id})" style="margin-left:4px">💾</button>`;
}

async function saveUser(id) {
    const name = document.getElementById(`edit-name-${id}`).value;
    const mobile = document.getElementById(`edit-mobile-${id}`).value;
    const res = await api(`/api/users/${id}`, 'PUT', { name, mobile });
    if (res.success) {
        toast('User updated', 'success');
        loadUsers();
    } else {
        toast(res.message, 'error');
    }
}

async function toggleUser(id, newStatus) {
    const res = await api(`/api/users/${id}/status`, 'PUT', { is_active: newStatus });
    if (res.success) {
        toast(res.message, 'success');
        loadUsers();
    } else {
        toast(res.message, 'error');
    }
}

async function deleteUser(id) {
    if (!confirm('Delete this user? This cannot be undone.')) return;
    const res = await api(`/api/users/${id}`, 'DELETE');
    if (res.success) {
        toast('User deleted', 'success');
        loadUsers();
    } else {
        toast(res.message, 'error');
    }
}

// ─── Keys ───────────────────────────────────────────────────────
async function loadKeys() {
    try {
        const res = await api('/api/keys');
        if (!res.success) return;

        const tbody = document.getElementById('keysTable');
        if (res.keys.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">No keys generated yet</td></tr>';
        } else {
            tbody.innerHTML = res.keys.map(k => {
                let status, badge;
                if (k.is_revoked) { status = 'Revoked'; badge = 'badge-danger'; }
                else if (k.is_used) { status = 'Used'; badge = 'badge-warning'; }
                else { status = 'Available'; badge = 'badge-success'; }

                return `
                    <tr>
                        <td><span class="key-value">${esc(k.key_value)}</span></td>
                        <td>${esc(k.plan_name)}</td>
                        <td>${k.duration_days} days</td>
                        <td><span class="badge ${badge}">${status}</span></td>
                        <td>${k.used_by_username ? esc(k.used_by_username) : '<span class="text-muted">—</span>'}</td>
                        <td>${formatDate(k.created_at)}</td>
                        <td>
                            ${!k.is_used && !k.is_revoked
                        ? `<button class="btn btn-sm btn-danger" onclick="revokeKey(${k.id})">Revoke</button>`
                        : '<span class="text-muted">—</span>'}
                        </td>
                    </tr>
                `;
            }).join('');
        }
    } catch (err) {
        toast('Failed to load keys', 'error');
    }
}

async function generateKeys() {
    const count = parseInt(document.getElementById('keyCount').value) || 1;
    const plan_name = document.getElementById('keyPlan').value;
    const duration_days = parseInt(document.getElementById('keyDuration').value) || 30;

    const res = await api('/api/keys/generate', 'POST', { count, plan_name, duration_days });
    if (res.success) {
        toast(`Generated ${res.keys.length} key(s)`, 'success');
        loadKeys();
    } else {
        toast(res.message, 'error');
    }
}

async function revokeKey(id) {
    if (!confirm('Revoke this key?')) return;
    const res = await api(`/api/keys/${id}/revoke`, 'PUT');
    if (res.success) {
        toast('Key revoked', 'success');
        loadKeys();
    } else {
        toast(res.message, 'error');
    }
}

// ─── Licenses ───────────────────────────────────────────────────
async function loadLicenses() {
    try {
        // Reuse dashboard API which includes recent licenses
        const res = await api('/api/dashboard');
        if (!res.success) return;

        // Fetch all users to get full license list
        const usersRes = await api('/api/users');
        if (!usersRes.success) return;

        const tbody = document.getElementById('licensesTable');
        const licensedUsers = usersRes.users.filter(u => u.license);

        if (licensedUsers.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No licenses yet</td></tr>';
        } else {
            tbody.innerHTML = licensedUsers.map(u => {
                const l = u.license;
                const isExpired = new Date(l.expiry_date) < new Date();
                return `
                    <tr>
                        <td><strong>${esc(u.username)}</strong></td>
                        <td><span class="badge badge-info">${esc(l.plan_name)}</span></td>
                        <td><span class="text-muted">••••${u.id}</span></td>
                        <td>${formatDate(l.expiry_date)}</td>
                        <td>${esc(l.payment_status || '—')}</td>
                        <td>${isExpired
                        ? '<span class="badge badge-danger">Expired</span>'
                        : '<span class="badge badge-success">Active</span>'}</td>
                    </tr>
                `;
            }).join('');
        }
    } catch (err) {
        toast('Failed to load licenses', 'error');
    }
}

// ─── API Helper ─────────────────────────────────────────────────
async function api(url, method = 'GET', body = null, auth = true) {
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    if (auth && token) opts.headers['Authorization'] = 'Bearer ' + token;
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(url, opts);
    if (res.status === 401 && auth) {
        doLogout();
        toast('Session expired, please login again', 'error');
        throw new Error('Unauthorized');
    }
    return res.json();
}

// ─── Utilities ──────────────────────────────────────────────────
function esc(str) {
    if (!str) return '';
    const el = document.createElement('span');
    el.textContent = str;
    return el.innerHTML;
}

function formatDate(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function toast(msg, type = 'success') {
    const container = document.getElementById('toastContainer');
    const el = document.createElement('div');
    el.className = 'toast ' + type;
    el.innerHTML = `${type === 'success' ? '✅' : '❌'} ${esc(msg)}`;
    container.appendChild(el);
    setTimeout(() => el.remove(), 4000);
}
