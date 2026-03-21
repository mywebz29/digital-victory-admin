const express = require('express');
const router = express.Router();
const { queries } = require('../database');

// ─── GET /api/plans — List all plans ────────────────────────────
router.get('/', async (req, res) => {
    try {
        const plans = await queries.getAllPlans.all();
        res.json({ success: true, plans });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─── POST /api/plans — Create a plan ────────────────────────────
router.post('/', async (req, res) => {
    try {
        const { name, duration_days, price, features, max_sms_per_day, max_whatsapp_per_day } = req.body;
        if (!name) return res.status(400).json({ success: false, message: 'Plan name is required' });

        const plan = await queries.createPlan.run({
            name, duration_days: duration_days || 30,
            price: price || 0,
            features: features || { sms: true, whatsapp: false, broadcast: false, minisite: false, posters: false },
            max_sms_per_day: max_sms_per_day || 100,
            max_whatsapp_per_day: max_whatsapp_per_day || 50
        });
        res.json({ success: true, plan, message: 'Plan created' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─── PUT /api/plans/:id — Update a plan ─────────────────────────
router.put('/:id', async (req, res) => {
    try {
        const { name, duration_days, price, features, max_sms_per_day, max_whatsapp_per_day, is_active } = req.body;
        await queries.updatePlan.run(req.params.id, {
            name, duration_days, price, features, max_sms_per_day, max_whatsapp_per_day, is_active
        });
        res.json({ success: true, message: 'Plan updated' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─── DELETE /api/plans/:id — Delete a plan ──────────────────────
router.delete('/:id', async (req, res) => {
    try {
        await queries.deletePlan.run(req.params.id);
        res.json({ success: true, message: 'Plan deleted' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
