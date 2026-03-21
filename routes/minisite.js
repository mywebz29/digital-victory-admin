const express = require('express');
const router = express.Router();
const { queries } = require('../database');
const { supabase } = require('../supabase');
const multer = require('multer');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// ─── POST /api/minisite/upload — Upload image to storage ────────
router.post('/upload', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, message: 'Image is required' });

        const fileName = `minisite-${Date.now()}-${req.file.originalname}`;
        const { error } = await supabase.storage.from('poster-templates').upload(fileName, req.file.buffer, {
            contentType: req.file.mimetype, upsert: false
        });
        if (error) throw error;

        const { data: urlData } = supabase.storage.from('poster-templates').getPublicUrl(fileName);
        res.json({ success: true, url: urlData.publicUrl });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});
// ─── POST /api/minisite — Create or update mini site ────────────
router.post('/', async (req, res) => {
    try {
        const { oldSlug, slug, businessName, tagline, phone, whatsapp, email, address, mapsLink, services, upiId, logoUrl, bannerUrl, products, gallery, customLinks } = req.body;
        if (!businessName) {
            return res.status(400).json({ success: false, message: 'Business name is required' });
        }

        let newSlug = slug;
        if (!newSlug) {
            newSlug = businessName.toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-|-$/g, '');
        }

        const result = await queries.upsertMiniSite.run(oldSlug, newSlug, {
            business_name: businessName, tagline, phone, whatsapp, email, address,
            maps_link: mapsLink, services, upi_id: upiId,
            logo_url: logoUrl, banner_url: bannerUrl, products: products,
            gallery: gallery, custom_links: customLinks
        });

        res.json({
            success: true, slug,
            url: `/site/${slug}`,
            message: result.lastInsertRowid ? 'Mini site created' : 'Mini site updated'
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─── GET /api/minisite/:slug — Get mini site data ───────────────
router.get('/:slug', async (req, res) => {
    try {
        const site = await queries.getMiniSiteBySlug.get(req.params.slug);
        if (!site) return res.status(404).json({ success: false, message: 'Site not found' });
        // remap snake_case to camelCase for app compatibility
        res.json({
            success: true, site: {
                businessName: site.business_name, tagline: site.tagline,
                phone: site.phone, whatsapp: site.whatsapp, email: site.email,
                address: site.address, mapsLink: site.maps_link,
                services: site.services, upiId: site.upi_id,
                logoUrl: site.logo_url, bannerUrl: site.banner_url,
                products: site.products,
                gallery: site.gallery, customLinks: site.custom_links
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─── GET /api/minisite/:slug/vcard — Download Contact (vCard) ───
router.get('/:slug/vcard', async (req, res) => {
    try {
        const site = await queries.getMiniSiteBySlug.get(req.params.slug);
        if (!site) return res.status(404).send('Site not found');

        const bName = site.business_name || site.slug;
        const phone = site.phone || '';
        const email = site.email || '';
        const address = site.address || '';
        const currentUrl = `https://connectitapp.in/site/${site.slug}`;

        let vcard = `BEGIN:VCARD\r\nVERSION:3.0\r\nFN:${bName}\r\nORG:${bName}\r\n`;
        if (phone) vcard += `TEL;TYPE=WORK,VOICE:${phone}\r\n`;
        if (email) vcard += `EMAIL;TYPE=PREF,INTERNET:${email}\r\n`;
        if (address) vcard += `ADR;TYPE=WORK:;;${address.replace(/\n/g, ' ')};;;;\r\n`;
        vcard += `URL:${currentUrl}\r\nEND:VCARD\r\n`;

        res.setHeader('Content-Type', 'text/vcard');
        res.setHeader('Content-Disposition', `attachment; filename="${site.slug}.vcf"`);
        res.send(vcard);
    } catch (err) {
        res.status(500).send('Error generating vCard');
    }
});

// ─── GET /api/minisites — List all mini sites ───────────────────
router.get('/', async (req, res) => {
    try {
        const sites = await queries.getAllMiniSites.all();
        res.json({ success: true, sites });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
