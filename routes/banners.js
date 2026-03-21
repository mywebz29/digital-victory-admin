const express = require('express');
const router = express.Router();
const { queries } = require('../database');
const { supabase } = require('../supabase');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// ─── GET /api/banners — List all banners ────────────────────────
router.get('/', async (req, res) => {
    try {
        const banners = await queries.getAllBanners.all();
        res.json({ success: true, banners });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─── POST /api/banners — Upload banner ──────────────────────────
router.post('/', upload.single('image'), async (req, res) => {
    try {
        const { title, link_url, link_type } = req.body;
        if (!title || !req.file) {
            return res.status(400).json({ success: false, message: 'Title and image required' });
        }

        const fileName = `banners/${Date.now()}-${req.file.originalname}`;
        const { error: uploadError } = await supabase.storage
            .from('poster-templates')
            .upload(fileName, req.file.buffer, { contentType: req.file.mimetype });
        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage.from('poster-templates').getPublicUrl(fileName);

        const banner = await queries.createBanner.run({
            title, image_url: urlData.publicUrl,
            link_url: link_url || '', link_type: link_type || 'none'
        });
        res.json({ success: true, banner, message: 'Banner uploaded' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─── PUT /api/banners/:id — Update banner ───────────────────────
router.put('/:id', async (req, res) => {
    try {
        const { title, link_url, link_type, is_active, sort_order } = req.body;
        const updates = {};
        if (title !== undefined) updates.title = title;
        if (link_url !== undefined) updates.link_url = link_url;
        if (link_type !== undefined) updates.link_type = link_type;
        if (is_active !== undefined) updates.is_active = is_active;
        if (sort_order !== undefined) updates.sort_order = sort_order;
        await queries.updateBanner.run(req.params.id, updates);
        res.json({ success: true, message: 'Banner updated' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─── DELETE /api/banners/:id — Delete banner ────────────────────
router.delete('/:id', async (req, res) => {
    try {
        await queries.deleteBanner.run(req.params.id);
        res.json({ success: true, message: 'Banner deleted' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
