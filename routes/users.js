const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { queries } = require('../database');

// ─── GET /api/users — List all users ────────────────────────────
router.get('/', (req, res) => {
    try {
        const users = queries.getAllUsers.all();
        // Attach license info to each user
        const usersWithLicense = users.map(user => {
            const license = queries.getLicenseByUserId.get(user.id);
            return {
                ...user,
                license: license ? {
                    plan_name: license.plan_name,
                    expiry_date: license.expiry_date,
                    is_active: license.is_active,
                    payment_status: license.payment_status
                } : null
            };
        });
        res.json({ success: true, users: usersWithLicense });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─── GET /api/users/:id — Get single user ───────────────────────
router.get('/:id', (req, res) => {
    try {
        const user = queries.getUserById.get(req.params.id);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        const license = queries.getLicenseByUserId.get(user.id);
        delete user.password_hash;
        res.json({ success: true, user: { ...user, license } });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─── PUT /api/users/:id/status — Toggle user active status ─────
router.put('/:id/status', (req, res) => {
    try {
        const { is_active } = req.body;
        queries.updateUserStatus.run(is_active ? 1 : 0, parseInt(req.params.id));
        res.json({ success: true, message: `User ${is_active ? 'activated' : 'deactivated'}` });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─── PUT /api/users/:id — Edit user name, mobile, email ────────
router.put('/:id', (req, res) => {
    try {
        const { name, mobile, email } = req.body;
        queries.updateUser.run(parseInt(req.params.id), { name, mobile, email });
        res.json({ success: true, message: 'User updated' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─── DELETE /api/users/:id — Delete user ────────────────────────
router.delete('/:id', (req, res) => {
    try {
        queries.deleteUser.run(req.params.id);
        res.json({ success: true, message: 'User deleted' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
