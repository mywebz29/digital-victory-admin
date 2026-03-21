const express = require('express');
const router = express.Router();
const { queries } = require('../database');

// ─── GET /api/users — List all users ────────────────────────────
router.get('/', async (req, res) => {
    try {
        const users = await queries.getAllUsers.all();
        const usersWithLicense = await Promise.all(users.map(async user => {
            const license = await queries.getLicenseByUserId.get(user.id);
            return {
                ...user,
                license: license ? {
                    plan_name: license.plan_name,
                    expiry_date: license.expiry_date,
                    is_active: license.is_active,
                    payment_status: license.payment_status
                } : null
            };
        }));
        res.json({ success: true, users: usersWithLicense });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─── GET /api/users/:id — Get single user ───────────────────────
router.get('/:id', async (req, res) => {
    try {
        const user = await queries.getUserById.get(req.params.id);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        const license = await queries.getLicenseByUserId.get(user.id);
        delete user.password_hash;
        res.json({ success: true, user: { ...user, license } });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─── PUT /api/users/:id/status — Toggle user active status ─────
router.put('/:id/status', async (req, res) => {
    try {
        const { is_active } = req.body;
        await queries.updateUserStatus.run(!!is_active, req.params.id);
        res.json({ success: true, message: `User ${is_active ? 'activated' : 'deactivated'}` });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─── PUT /api/users/:id — Edit user name, mobile, email ────────
router.put('/:id', async (req, res) => {
    try {
        const { name, mobile, email } = req.body;
        await queries.updateUser.run(req.params.id, { name, mobile, email });
        res.json({ success: true, message: 'User updated' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─── DELETE /api/users/:id — Delete user ────────────────────────
router.delete('/:id', async (req, res) => {
    try {
        await queries.deleteUser.run(req.params.id);
        res.json({ success: true, message: 'User deleted' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
