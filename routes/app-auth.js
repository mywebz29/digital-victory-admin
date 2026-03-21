const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { queries } = require('../database');

// ─── POST /promobot/login — App login ─────────────────────
router.post('/login', async (req, res) => {
    try {
        const { username, password, activationKey, deviceId } = req.body;

        if (!username || !password) {
            return res.json({ success: false, message: 'Username and password required' });
        }

        let user = await queries.getUserByUsername.get(username);

        if (user) {
            if (!bcrypt.compareSync(password, user.password_hash)) {
                return res.json({ success: false, message: 'Invalid password' });
            }
            if (!user.is_active) {
                return res.json({ success: false, message: 'Account deactivated. Contact support.' });
            }
        } else {
            if (!activationKey) {
                return res.json({ success: false, message: 'Activation key required for new registration' });
            }

            const key = await queries.getKeyByValue.get(activationKey);
            if (!key) return res.json({ success: false, message: 'Invalid activation key' });
            if (key.is_used) return res.json({ success: false, message: 'Activation key already used' });
            if (key.is_revoked) return res.json({ success: false, message: 'Activation key has been revoked' });

            const passwordHash = bcrypt.hashSync(password, 10);
            const result = await queries.createUser.run(
                username, passwordHash, '', deviceId || '',
                key.assigned_username || '', key.assigned_mobile || ''
            );
            const userId = result.id || result.lastInsertRowid;

            await queries.markKeyUsed.run(userId, key.id);

            const token = uuidv4();
            const expiryDate = new Date();
            expiryDate.setDate(expiryDate.getDate() + key.duration_days);

            await queries.createLicense.run(
                userId, key.id, token,
                expiryDate.toISOString(), key.plan_name, '0', 'Paid', ''
            );

            user = await queries.getUserById.get(userId);
        }

        const license = await queries.getLicenseByUserId.get(user.id);

        if (!license) {
            return res.json({ success: false, message: 'No active license found. Contact support.' });
        }
        if (new Date(license.expiry_date) < new Date()) {
            return res.json({ success: false, message: 'License expired. Please renew.' });
        }

        // Get plan features
        const plan = await queries.getPlanByName.get(license.plan_name);

        res.json({
            success: true,
            token: license.token,
            expiry_date: license.expiry_date,
            message: 'Login successful',
            user: {
                username: user.username,
                email: user.email,
                plan: license.plan_name,
                name: user.name || '',
                mobile: user.mobile || ''
            },
            features: plan ? plan.features : {},
            max_sms_per_day: plan ? plan.max_sms_per_day : 100,
            max_whatsapp_per_day: plan ? plan.max_whatsapp_per_day : 50,
            subscription_duration: license.plan_name,
            plan_amount: license.plan_amount,
            payment_status: license.payment_status,
            support_mobile: license.support_mobile
        });

    } catch (err) {
        console.error('Login error:', err);
        res.json({ success: false, message: 'Server error: ' + err.message });
    }
});

// ─── GET /promobot/validate — Validate license token ──────
router.get('/validate', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.json({ success: false, message: 'No token provided' });
        }

        const token = authHeader.split(' ')[1];
        const license = await queries.getLicenseByToken.get(token);

        if (!license) return res.json({ success: false, message: 'Invalid token' });
        if (!license.is_active) return res.json({ success: false, message: 'License deactivated' });
        if (new Date(license.expiry_date) < new Date()) return res.json({ success: false, message: 'License expired' });

        const plan = await queries.getPlanByName.get(license.plan_name);

        res.json({
            success: true,
            token: license.token,
            expiry_date: license.expiry_date,
            message: 'License valid',
            user: { username: license.username, plan: license.plan_name },
            features: plan ? plan.features : {},
            max_sms_per_day: plan ? plan.max_sms_per_day : 100,
            max_whatsapp_per_day: plan ? plan.max_whatsapp_per_day : 50
        });

    } catch (err) {
        res.json({ success: false, message: 'Server error: ' + err.message });
    }
});

// ─── POST /promobot/renew — Renew expired license ─────────
router.post('/renew', async (req, res) => {
    try {
        const { username, password, activationKey } = req.body;

        if (!username || !password || !activationKey) {
            return res.json({ success: false, message: 'Username, password, and activation key required' });
        }

        const user = await queries.getUserByUsername.get(username);
        if (!user) return res.json({ success: false, message: 'User not found' });
        if (!bcrypt.compareSync(password, user.password_hash)) return res.json({ success: false, message: 'Invalid password' });
        if (!user.is_active) return res.json({ success: false, message: 'Account deactivated. Contact support.' });

        const key = await queries.getKeyByValue.get(activationKey);
        if (!key) return res.json({ success: false, message: 'Invalid activation key' });
        if (key.is_used) return res.json({ success: false, message: 'Activation key already used' });
        if (key.is_revoked) return res.json({ success: false, message: 'Activation key has been revoked' });

        await queries.markKeyUsed.run(user.id, key.id);

        const token = uuidv4();
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + key.duration_days);

        await queries.createLicense.run(
            user.id, key.id, token,
            expiryDate.toISOString(), key.plan_name, '0', 'Paid', ''
        );

        const plan = await queries.getPlanByName.get(key.plan_name);

        res.json({
            success: true,
            token, expiry_date: expiryDate.toISOString(),
            message: 'License renewed successfully!',
            user: { username: user.username, email: user.email, plan: key.plan_name, name: user.name || '', mobile: user.mobile || '' },
            features: plan ? plan.features : {},
            subscription_duration: key.plan_name,
            plan_amount: '0', payment_status: 'Paid', support_mobile: ''
        });

    } catch (err) {
        console.error('Renew error:', err);
        res.json({ success: false, message: 'Server error: ' + err.message });
    }
});

// ─── GET /promobot/posters — Get active poster templates ────
router.get('/posters', async (req, res) => {
    try {
        const category = req.query.category;
        const posters = category
            ? await queries.getPostersByCategory.all(category)
            : await queries.getActivePosters.all();
        res.json({ success: true, posters });
    } catch (err) {
        res.json({ success: false, message: err.message });
    }
});

// ─── GET /promobot/banners — Get active banners for app ─────
router.get('/banners', async (req, res) => {
    try {
        const banners = await queries.getActiveBanners.all();
        res.json({ success: true, banners });
    } catch (err) {
        res.json({ success: false, message: err.message });
    }
});

module.exports = router;
