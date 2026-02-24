const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { queries } = require('../database');
const { JWT_SECRET } = require('../middleware/auth');

// ─── POST /api/auth/login — Admin login ─────────────────────────
router.post('/login', (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ success: false, message: 'Username and password required' });
        }

        const admin = queries.getAdminByUsername.get(username);
        if (!admin) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        if (!bcrypt.compareSync(password, admin.password_hash)) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { id: admin.id, username: admin.username },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            success: true,
            token,
            admin: { id: admin.id, username: admin.username }
        });

    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─── GET /api/dashboard — Stats for admin dashboard ─────────────
router.get('/dashboard', (req, res) => {
    try {
        const totalUsers = queries.getUserCount.get().count;
        const activeUsers = queries.getActiveUserCount.get().count;
        const activeLicenses = queries.getActiveLicenseCount.get().count;
        const expiredLicenses = queries.getExpiredLicenseCount.get().count;
        const unusedKeys = queries.getUnusedKeyCount.get().count;
        const recentLicenses = queries.getRecentLicenses.all();

        res.json({
            success: true,
            stats: {
                totalUsers,
                activeUsers,
                activeLicenses,
                expiredLicenses,
                unusedKeys,
                recentLicenses
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
