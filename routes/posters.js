const express = require('express');
const router = express.Router();
const { queries } = require('../database');
const { supabase } = require('../supabase');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Use memory storage for Supabase upload
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// ─── GET /api/posters — List all poster templates ───────────────
router.get('/', async (req, res) => {
    try {
        const posters = await queries.getAllPosters.all();
        res.json({ success: true, posters });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─── POST /api/posters — Upload a new poster template ───────────
router.post('/', upload.single('background'), async (req, res) => {
    try {
        const { name, category, overlay_config } = req.body;
        if (!name || !req.file) {
            return res.status(400).json({ success: false, message: 'Name and background image are required' });
        }

        // Upload to Supabase Storage
        const fileName = `${Date.now()}-${req.file.originalname}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('poster-templates')
            .upload(fileName, req.file.buffer, {
                contentType: req.file.mimetype,
                upsert: false
            });

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: urlData } = supabase.storage
            .from('poster-templates')
            .getPublicUrl(fileName);

        const backgroundUrl = urlData.publicUrl;

        const poster = await queries.createPoster.run({
            name,
            category: category || 'generic',
            background_url: backgroundUrl,
            thumbnail_url: backgroundUrl,
            overlay_config: overlay_config ? JSON.parse(overlay_config) : {
                name_x: 50, name_y: 80, mobile_x: 50, mobile_y: 88,
                logo_x: 50, logo_y: 15, logo_size: 80,
                text_color: '#FFFFFF', font_size: 28
            }
        });

        res.json({ success: true, poster, message: 'Poster template uploaded' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─── PUT /api/posters/:id — Update poster template ──────────────
router.put('/:id', async (req, res) => {
    try {
        const { name, category, overlay_config, is_active, sort_order } = req.body;
        const updates = {};
        if (name !== undefined) updates.name = name;
        if (category !== undefined) updates.category = category;
        if (overlay_config !== undefined) updates.overlay_config = overlay_config;
        if (is_active !== undefined) updates.is_active = is_active;
        if (sort_order !== undefined) updates.sort_order = sort_order;

        await queries.updatePoster.run(req.params.id, updates);
        res.json({ success: true, message: 'Poster updated' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─── DELETE /api/posters/:id — Delete poster template ───────────
router.delete('/:id', async (req, res) => {
    try {
        await queries.deletePoster.run(req.params.id);
        res.json({ success: true, message: 'Poster deleted' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
