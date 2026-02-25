const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { queries } = require('../database');

// ─── Generate activation key string ────────────────────────────
function generateKey() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let key = 'DV-';
    for (let i = 0; i < 4; i++) {
        if (i > 0) key += '-';
        for (let j = 0; j < 4; j++) {
            key += chars[Math.floor(Math.random() * chars.length)];
        }
    }
    return key;
}

// ─── GET /api/keys — List all keys ──────────────────────────────
router.get('/', (req, res) => {
    try {
        const keys = queries.getAllKeys.all();
        res.json({ success: true, keys });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─── POST /api/keys/generate — Generate new keys ────────────────
router.post('/generate', (req, res) => {
    try {
        const { count = 1, plan_name = 'Basic', duration_days = 30, username = '', mobile = '' } = req.body;
        const generated = [];

        for (let i = 0; i < Math.min(count, 50); i++) {
            const keyValue = generateKey();
            queries.createKey.run(keyValue, plan_name, duration_days, username, mobile);
            generated.push(keyValue);
        }

        res.json({ success: true, keys: generated, message: `Generated ${generated.length} key(s)` });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─── PUT /api/keys/:id/revoke — Revoke a key ───────────────────
router.put('/:id/revoke', (req, res) => {
    try {
        queries.revokeKey.run(req.params.id);
        res.json({ success: true, message: 'Key revoked' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
