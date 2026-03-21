const bcrypt = require('bcryptjs');
const { supabase } = require('./supabase');

// ═══════════════════════════════════════════════════════════════
// Supabase-backed query layer
// Same API surface as the old JSON file DB for backward compatibility
// ═══════════════════════════════════════════════════════════════

const queries = {

    // ─── Admin ──────────────────────────────────────────────────
    getAdminByUsername: {
        get: async (username) => {
            const { data } = await supabase.from('users').select('*').eq('username', username).single();
            return data;
        }
    },

    // ─── Users ──────────────────────────────────────────────────
    getAllUsers: {
        all: async () => {
            const { data } = await supabase.from('users')
                .select('*').order('created_at', { ascending: false });
            return (data || []).map(({ password_hash, ...rest }) => rest);
        }
    },
    getUserById: {
        get: async (id) => {
            const { data } = await supabase.from('users').select('*').eq('id', id).single();
            return data;
        }
    },
    getUserByUsername: {
        get: async (username) => {
            const { data } = await supabase.from('users').select('*').eq('username', username).single();
            return data;
        }
    },
    createUser: {
        run: async (username, password_hash, email, device_id, name, mobile) => {
            const { data, error } = await supabase.from('users')
                .insert({ username, password_hash, email, device_id, name: name || '', mobile: mobile || '' })
                .select().single();
            if (error) throw error;
            return { lastInsertRowid: data.id, id: data.id };
        }
    },
    updateUser: {
        run: async (id, updates) => {
            await supabase.from('users')
                .update({ ...updates, updated_at: new Date().toISOString() })
                .eq('id', id);
        }
    },
    updateUserDeviceId: {
        run: (id, device_id) => {
            const d = loadData();
            const user = d.users.find(u => u.id === id);
            if (user) {
                user.device_id = device_id;
                user.updated_at = new Date().toISOString();
                saveData(d);
            }
        }
    },
    updateUserStatus: {
        run: async (is_active, id) => {
            await supabase.from('users')
                .update({ is_active, updated_at: new Date().toISOString() })
                .eq('id', id);
        }
    },
    deleteUser: {
        run: async (id) => {
            await supabase.from('users').delete().eq('id', id);
        }
    },
    getUserCount: {
        get: async () => {
            const { count } = await supabase.from('users').select('*', { count: 'exact', head: true });
            return { count: count || 0 };
        }
    },
    getActiveUserCount: {
        get: async () => {
            const { count } = await supabase.from('users').select('*', { count: 'exact', head: true }).eq('is_active', true);
            return { count: count || 0 };
        }
    },

    // ─── Activation Keys ────────────────────────────────────────
    getAllKeys: {
        all: async () => {
            const { data } = await supabase.from('activation_keys')
                .select('*, users(username)')
                .order('created_at', { ascending: false });
            return (data || []).map(k => ({
                ...k,
                used_by_username: k.users?.username || null,
                users: undefined
            }));
        }
    },
    getKeyByValue: {
        get: async (key_value) => {
            const { data } = await supabase.from('activation_keys').select('*').eq('key_value', key_value).single();
            return data;
        }
    },
    createKey: {
        run: async (key_value, plan_name, duration_days, assigned_username, assigned_mobile) => {
            const { data, error } = await supabase.from('activation_keys')
                .insert({ key_value, plan_name, duration_days, assigned_username: assigned_username || '', assigned_mobile: assigned_mobile || '' })
                .select().single();
            if (error) throw error;
            return { lastInsertRowid: data.id };
        }
    },
    markKeyUsed: {
        run: async (user_id, key_id) => {
            await supabase.from('activation_keys')
                .update({ is_used: true, user_id, used_at: new Date().toISOString() })
                .eq('id', key_id);
        }
    },
    revokeKey: {
        run: async (id) => {
            await supabase.from('activation_keys').update({ is_revoked: true }).eq('id', id);
        }
    },
    getUnusedKeyCount: {
        get: async () => {
            const { count } = await supabase.from('activation_keys')
                .select('*', { count: 'exact', head: true })
                .eq('is_used', false).eq('is_revoked', false);
            return { count: count || 0 };
        }
    },

    // ─── Licenses ───────────────────────────────────────────────
    getAllLicenses: {
        all: async () => {
            const { data } = await supabase.from('licenses')
                .select('*, users(username)')
                .order('created_at', { ascending: false });
            return (data || []).map(l => ({
                ...l,
                username: l.users?.username || 'Unknown',
                users: undefined
            }));
        }
    },
    getLicenseByToken: {
        get: async (token) => {
            const { data } = await supabase.from('licenses')
                .select('*, users(username)')
                .eq('token', token).single();
            if (!data) return null;
            return { ...data, username: data.users?.username || 'Unknown', users: undefined };
        }
    },
    getLicenseByUserId: {
        get: async (user_id) => {
            const { data } = await supabase.from('licenses')
                .select('*')
                .eq('user_id', user_id).eq('is_active', true)
                .order('created_at', { ascending: false })
                .limit(1).single();
            return data;
        }
    },
    createLicense: {
        run: async (user_id, key_id, token, expiry_date, plan_name, plan_amount, payment_status, support_mobile) => {
            const { data, error } = await supabase.from('licenses')
                .insert({ user_id, key_id, token, expiry_date, plan_name, plan_amount, payment_status, support_mobile })
                .select().single();
            if (error) throw error;
            return { lastInsertRowid: data.id };
        }
    },
    deactivateLicense: {
        run: async (id) => {
            await supabase.from('licenses').update({ is_active: false }).eq('id', id);
        }
    },
    getActiveLicenseCount: {
        get: async () => {
            const { count } = await supabase.from('licenses')
                .select('*', { count: 'exact', head: true })
                .eq('is_active', true).gt('expiry_date', new Date().toISOString());
            return { count: count || 0 };
        }
    },
    getExpiredLicenseCount: {
        get: async () => {
            const { count } = await supabase.from('licenses')
                .select('*', { count: 'exact', head: true })
                .lte('expiry_date', new Date().toISOString());
            return { count: count || 0 };
        }
    },
    getRecentLicenses: {
        all: async () => {
            const { data } = await supabase.from('licenses')
                .select('*, users(username)')
                .order('created_at', { ascending: false })
                .limit(10);
            return (data || []).map(l => ({
                ...l,
                username: l.users?.username || 'Unknown',
                users: undefined
            }));
        }
    },

    // ─── Plans ──────────────────────────────────────────────────
    getAllPlans: {
        all: async () => {
            const { data } = await supabase.from('plans').select('*').order('id');
            return data || [];
        }
    },
    getPlanByName: {
        get: async (name) => {
            const { data } = await supabase.from('plans').select('*').eq('name', name).single();
            return data;
        }
    },
    createPlan: {
        run: async (planData) => {
            const { data, error } = await supabase.from('plans').insert(planData).select().single();
            if (error) throw error;
            return data;
        }
    },
    updatePlan: {
        run: async (id, updates) => {
            await supabase.from('plans').update(updates).eq('id', id);
        }
    },
    deletePlan: {
        run: async (id) => {
            await supabase.from('plans').delete().eq('id', id);
        }
    },

    // ─── Mini Sites ─────────────────────────────────────────────
    upsertMiniSite: {
        run: async (oldSlug, newSlug, siteData) => {
            // If we're updating a specific old slug, check if it exists
            if (oldSlug) {
                const { data: existing } = await supabase.from('mini_sites').select('id').eq('slug', oldSlug).single();
                if (existing) {
                    await supabase.from('mini_sites')
                        .update({ ...siteData, slug: newSlug, updated_at: new Date().toISOString() })
                        .eq('id', existing.id);
                    return { id: existing.id, slug: newSlug };
                }
            }
            
            // Otherwise, it’s either a new site or oldSlug wasn't found (fallback to upsert by slug)
            const { data: existingByNewSlug } = await supabase.from('mini_sites').select('id').eq('slug', newSlug).single();
            if (existingByNewSlug) {
                await supabase.from('mini_sites')
                    .update({ ...siteData, updated_at: new Date().toISOString() })
                    .eq('slug', newSlug);
                return { id: existingByNewSlug.id, slug: newSlug };
            } else {
                const { data, error } = await supabase.from('mini_sites')
                    .insert({ slug: newSlug, ...siteData }).select().single();
                if (error) throw error;
                return { lastInsertRowid: data.id, slug: newSlug };
            }
        }
    },
    getMiniSiteBySlug: {
        get: async (slug) => {
            const { data } = await supabase.from('mini_sites').select('*').eq('slug', slug).single();
            return data;
        }
    },
    getAllMiniSites: {
        all: async () => {
            const { data } = await supabase.from('mini_sites').select('*').order('created_at', { ascending: false });
            return data || [];
        }
    },

    // ─── Poster Templates ───────────────────────────────────────
    getAllPosters: {
        all: async () => {
            const { data } = await supabase.from('poster_templates')
                .select('*').order('sort_order').order('created_at', { ascending: false });
            return data || [];
        }
    },
    getActivePosters: {
        all: async () => {
            const { data } = await supabase.from('poster_templates')
                .select('*').eq('is_active', true).order('sort_order');
            return data || [];
        }
    },
    getPostersByCategory: {
        all: async (category) => {
            const { data } = await supabase.from('poster_templates')
                .select('*').eq('category', category).eq('is_active', true).order('sort_order');
            return data || [];
        }
    },
    createPoster: {
        run: async (posterData) => {
            const { data, error } = await supabase.from('poster_templates').insert(posterData).select().single();
            if (error) throw error;
            return data;
        }
    },
    updatePoster: {
        run: async (id, updates) => {
            await supabase.from('poster_templates').update(updates).eq('id', id);
        }
    },
    deletePoster: {
        run: async (id) => {
            await supabase.from('poster_templates').delete().eq('id', id);
        }
    },

    // ─── Banners ────────────────────────────────────────────────
    getAllBanners: {
        all: async () => {
            const { data } = await supabase.from('banners')
                .select('*').order('sort_order').order('created_at', { ascending: false });
            return data || [];
        }
    },
    getActiveBanners: {
        all: async () => {
            const { data } = await supabase.from('banners')
                .select('*').eq('is_active', true).order('sort_order');
            return data || [];
        }
    },
    createBanner: {
        run: async (bannerData) => {
            const { data, error } = await supabase.from('banners').insert(bannerData).select().single();
            if (error) throw error;
            return data;
        }
    },
    updateBanner: {
        run: async (id, updates) => {
            await supabase.from('banners').update(updates).eq('id', id);
        }
    },
    deleteBanner: {
        run: async (id) => {
            await supabase.from('banners').delete().eq('id', id);
        }
    },
    restoreData: {
        run: (usersCached, keysCached, licensesCached) => {
            const d = loadData();

            if (usersCached && usersCached.length > 0) {
                // Strip out the injected .license property when restoring
                d.users = usersCached.map(({ license, ...rest }) => rest);
                d._counters.users = Math.max(0, ...d.users.map(u => u.id));
            }
            if (keysCached && keysCached.length > 0) {
                // Strip out the injected .used_by_username property
                d.activation_keys = keysCached.map(({ used_by_username, ...rest }) => rest);
                d._counters.activation_keys = Math.max(0, ...d.activation_keys.map(k => k.id));
            }
            if (licensesCached && licensesCached.length > 0) {
                // Strip out injected .username
                d.licenses = licensesCached.map(({ username, ...rest }) => rest);
                d._counters.licenses = Math.max(0, ...d.licenses.map(l => l.id));
            }
            saveData(d);
        }
    }
};

// ─── Seed admin user (if none exists) ───────────────────────────
(async () => {
    try {
        const { count } = await supabase.from('users').select('*', { count: 'exact', head: true }).eq('username', 'admin');
        if (count === 0) {
            const hash = bcrypt.hashSync('M112233M', 10);
            await supabase.from('users').insert({ username: 'admin', password_hash: hash, name: 'Admin', is_active: true });
            console.log('✓ Default admin seeded: admin / M112233M');
        }
    } catch (e) {
        console.warn('Admin seed skipped (Supabase may not be configured yet):', e.message);
    }
})();

module.exports = { queries, supabase };
