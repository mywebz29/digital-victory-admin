const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { queries } = require('../database');

const APP_TOKEN_SECRET = process.env.APP_TOKEN_SECRET || 'digital-victory-app-token-2024';

// ─── POST /digitalvictory/login — App login ─────────────────────
// Called by Android app's AuthApiClient
router.post('/login', (req, res) => {
    try {
        const { username, password, activationKey, deviceId } = req.body;

        if (!username || !password) {
            return res.json({ success: false, message: 'Username and password required' });
        }

        // Check if user exists
        let user = queries.getUserByUsername.get(username);

        if (user) {
            // Existing user — verify password
            if (!bcrypt.compareSync(password, user.password_hash)) {
                return res.json({ success: false, message: 'Invalid password' });
            }
            if (!user.is_active) {
                return res.json({ success: false, message: 'Account deactivated. Contact support.' });
            }
        } else {
            // New user — register with activation key
            if (!activationKey) {
                return res.json({ success: false, message: 'Activation key required for new registration' });
            }

            const key = queries.getKeyByValue.get(activationKey);
            if (!key) {
                return res.json({ success: false, message: 'Invalid activation key' });
            }
            if (key.is_used) {
                return res.json({ success: false, message: 'Activation key already used' });
            }
            if (key.is_revoked) {
                return res.json({ success: false, message: 'Activation key has been revoked' });
            }

            // Create new user
            const passwordHash = bcrypt.hashSync(password, 10);
            const result = queries.createUser.run(username, passwordHash, '', deviceId || '');
            const userId = result.lastInsertRowid;

            // Mark key as used
            queries.markKeyUsed.run(userId, key.id);

            // Create license
            const token = uuidv4();
            const expiryDate = new Date();
            expiryDate.setDate(expiryDate.getDate() + key.duration_days);

            queries.createLicense.run(
                userId, key.id, token,
                expiryDate.toISOString(),
                key.plan_name, '0', 'Paid', ''
            );

            user = queries.getUserById.get(userId);
        }

        // Get active license
        const license = queries.getLicenseByUserId.get(user.id);

        if (!license) {
            return res.json({ success: false, message: 'No active license found. Contact support.' });
        }

        // Check expiry
        if (new Date(license.expiry_date) < new Date()) {
            return res.json({ success: false, message: 'License expired. Please renew.' });
        }

        // Return success with license info
        res.json({
            success: true,
            token: license.token,
            expiry_date: license.expiry_date,
            message: 'Login successful',
            user: {
                username: user.username,
                email: user.email,
                plan: license.plan_name
            },
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

// ─── GET /digitalvictory/validate — Validate license token ──────
// Called by Android app's AuthApiClient
router.get('/validate', (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.json({ success: false, message: 'No token provided' });
        }

        const token = authHeader.split(' ')[1];
        const license = queries.getLicenseByToken.get(token);

        if (!license) {
            return res.json({ success: false, message: 'Invalid token' });
        }

        if (!license.is_active) {
            return res.json({ success: false, message: 'License deactivated' });
        }

        if (new Date(license.expiry_date) < new Date()) {
            return res.json({ success: false, message: 'License expired' });
        }

        res.json({
            success: true,
            token: license.token,
            expiry_date: license.expiry_date,
            message: 'License valid',
            user: {
                username: license.username,
                plan: license.plan_name
            }
        });

    } catch (err) {
        res.json({ success: false, message: 'Server error: ' + err.message });
    }
});

module.exports = router;
