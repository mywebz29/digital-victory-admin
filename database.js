const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

// ─── Data directory ─────────────────────────────────────────────
// On Vercel: use /tmp (ephemeral but writable). Locally: use ./data
const isVercel = process.env.VERCEL === '1';
const dataDir = isVercel ? '/tmp' : path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const DB_PATH = path.join(dataDir, 'digitalvictory.json');

// ─── Default data shape ────────────────────────────────────────
const DEFAULT_DATA = {
    admins: [],
    users: [],
    activation_keys: [],
    licenses: [],
    _counters: { admins: 0, users: 0, activation_keys: 0, licenses: 0 }
};

// ─── Load / Save ────────────────────────────────────────────────
function loadData() {
    try {
        if (fs.existsSync(DB_PATH)) {
            return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
        }
    } catch (e) {
        console.error('DB read error, resetting:', e.message);
    }
    return JSON.parse(JSON.stringify(DEFAULT_DATA));
}

function saveData(data) {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
}

function nextId(data, table) {
    data._counters[table] = (data._counters[table] || 0) + 1;
    return data._counters[table];
}

// ─── Seed default admin ─────────────────────────────────────────
let data = loadData();
if (data.admins.length === 0) {
    const id = nextId(data, 'admins');
    data.admins.push({
        id,
        username: 'admin',
        password_hash: bcrypt.hashSync('admin123', 10),
        created_at: new Date().toISOString()
    });
    saveData(data);
    console.log('✓ Default admin created: admin / admin123');
}

// ─── Query API (mimics the prepared-statement style) ────────────
const queries = {
    // Admin
    getAdminByUsername: { get: (username) => { const d = loadData(); return d.admins.find(a => a.username === username) || null; } },

    // Users
    getAllUsers: {
        all: () => {
            const d = loadData();
            return d.users.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                .map(({ password_hash, ...rest }) => rest);
        }
    },
    getUserById: { get: (id) => { const d = loadData(); return d.users.find(u => u.id === id) || null; } },
    getUserByUsername: { get: (username) => { const d = loadData(); return d.users.find(u => u.username === username) || null; } },
    createUser: {
        run: (username, password_hash, email, device_id, name, mobile) => {
            const d = loadData();
            const id = nextId(d, 'users');
            const user = { id, username, password_hash, email, device_id, name: name || '', mobile: mobile || '', is_active: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
            d.users.push(user);
            saveData(d);
            return { lastInsertRowid: id };
        }
    },
    updateUser: {
        run: (id, updates) => {
            const d = loadData();
            const user = d.users.find(u => u.id === id);
            if (user) {
                if (updates.name !== undefined) user.name = updates.name;
                if (updates.mobile !== undefined) user.mobile = updates.mobile;
                if (updates.email !== undefined) user.email = updates.email;
                user.updated_at = new Date().toISOString();
                saveData(d);
            }
        }
    },
    updateUserStatus: {
        run: (is_active, id) => {
            const d = loadData();
            const user = d.users.find(u => u.id === id);
            if (user) { user.is_active = is_active; user.updated_at = new Date().toISOString(); saveData(d); }
        }
    },
    deleteUser: {
        run: (id) => {
            const d = loadData();
            d.users = d.users.filter(u => u.id !== id);
            saveData(d);
        }
    },
    getUserCount: { get: () => { const d = loadData(); return { count: d.users.length }; } },
    getActiveUserCount: { get: () => { const d = loadData(); return { count: d.users.filter(u => u.is_active).length }; } },

    // Activation Keys
    getAllKeys: {
        all: () => {
            const d = loadData();
            return d.activation_keys.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                .map(k => {
                    const user = d.users.find(u => u.id === k.user_id);
                    return { ...k, used_by_username: user ? user.username : null };
                });
        }
    },
    getKeyByValue: { get: (key_value) => { const d = loadData(); return d.activation_keys.find(k => k.key_value === key_value) || null; } },
    createKey: {
        run: (key_value, plan_name, duration_days, assigned_username, assigned_mobile) => {
            const d = loadData();
            const id = nextId(d, 'activation_keys');
            d.activation_keys.push({
                id, key_value, user_id: null, plan_name, duration_days,
                assigned_username: assigned_username || '',
                assigned_mobile: assigned_mobile || '',
                is_used: 0, is_revoked: 0, created_at: new Date().toISOString(), used_at: null
            });
            saveData(d);
            return { lastInsertRowid: id };
        }
    },
    markKeyUsed: {
        run: (user_id, key_id) => {
            const d = loadData();
            const key = d.activation_keys.find(k => k.id === key_id);
            if (key) { key.is_used = 1; key.user_id = user_id; key.used_at = new Date().toISOString(); saveData(d); }
        }
    },
    revokeKey: {
        run: (id) => {
            const d = loadData();
            const key = d.activation_keys.find(k => k.id === id);
            if (key) { key.is_revoked = 1; saveData(d); }
        }
    },
    getUnusedKeyCount: { get: () => { const d = loadData(); return { count: d.activation_keys.filter(k => !k.is_used && !k.is_revoked).length }; } },

    // Licenses
    getAllLicenses: {
        all: () => {
            const d = loadData();
            return d.licenses.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                .map(l => {
                    const user = d.users.find(u => u.id === l.user_id);
                    return { ...l, username: user ? user.username : 'Unknown' };
                });
        }
    },
    getLicenseByToken: {
        get: (token) => {
            const d = loadData();
            const l = d.licenses.find(lic => lic.token === token);
            if (!l) return null;
            const user = d.users.find(u => u.id === l.user_id);
            return { ...l, username: user ? user.username : 'Unknown' };
        }
    },
    getLicenseByUserId: {
        get: (user_id) => {
            const d = loadData();
            return d.licenses
                .filter(l => l.user_id === user_id && l.is_active)
                .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0] || null;
        }
    },
    createLicense: {
        run: (user_id, key_id, token, expiry_date, plan_name, plan_amount, payment_status, support_mobile) => {
            const d = loadData();
            const id = nextId(d, 'licenses');
            d.licenses.push({ id, user_id, key_id, token, expiry_date, plan_name, plan_amount, payment_status, support_mobile, is_active: 1, created_at: new Date().toISOString() });
            saveData(d);
            return { lastInsertRowid: id };
        }
    },
    deactivateLicense: {
        run: (id) => {
            const d = loadData();
            const l = d.licenses.find(lic => lic.id === id);
            if (l) { l.is_active = 0; saveData(d); }
        }
    },
    getActiveLicenseCount: { get: () => { const d = loadData(); return { count: d.licenses.filter(l => l.is_active && new Date(l.expiry_date) > new Date()).length }; } },
    getExpiredLicenseCount: { get: () => { const d = loadData(); return { count: d.licenses.filter(l => new Date(l.expiry_date) <= new Date()).length }; } },
    getRecentLicenses: {
        all: () => {
            const d = loadData();
            return d.licenses
                .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                .slice(0, 10)
                .map(l => {
                    const user = d.users.find(u => u.id === l.user_id);
                    return { ...l, username: user ? user.username : 'Unknown' };
                });
        }
    }
};

module.exports = { queries };
