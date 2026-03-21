const express = require('express');
const cors = require('cors');
const path = require('path');

// Initialize database (seeds admin if needed)
require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ──────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── Admin API Routes (protected) ──────────────────────────────
const { authMiddleware } = require('./middleware/auth');
const adminRoutes = require('./routes/admin');
const userRoutes = require('./routes/users');
const keyRoutes = require('./routes/keys');
const planRoutes = require('./routes/plans');
const posterRoutes = require('./routes/posters');
const bannerRoutes = require('./routes/banners');
const minisiteRoutes = require('./routes/minisite');

app.use('/api/auth', adminRoutes);
app.use('/api/dashboard', authMiddleware, async (req, res) => {
    const { queries } = require('./database');
    try {
        const [totalUsers, activeUsers, activeLicenses, expiredLicenses, unusedKeys, recentLicenses] = await Promise.all([
            queries.getUserCount.get(),
            queries.getActiveUserCount.get(),
            queries.getActiveLicenseCount.get(),
            queries.getExpiredLicenseCount.get(),
            queries.getUnusedKeyCount.get(),
            queries.getRecentLicenses.all()
        ]);
        res.json({
            success: true,
            stats: {
                totalUsers: totalUsers.count,
                activeUsers: activeUsers.count,
                activeLicenses: activeLicenses.count,
                expiredLicenses: expiredLicenses.count,
                unusedKeys: unusedKeys.count,
                recentLicenses
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.use('/api/users', authMiddleware, userRoutes);
app.use('/api/keys', authMiddleware, keyRoutes);
app.use('/api/plans', authMiddleware, planRoutes);
app.use('/api/posters', authMiddleware, posterRoutes);
app.use('/api/banners', authMiddleware, bannerRoutes);

// ─── Public API Routes for Mobile App ────────────────────────
app.get('/api/public/posters', async (req, res) => {
    const { queries } = require('./database');
    try {
        const posters = await queries.getActivePosters.all();
        res.json({ success: true, posters });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─── Seed Sample Poster Templates (one-time) ────────────────
app.get('/api/public/posters/seed', async (req, res) => {
    const { queries } = require('./database');
    try {
        const existing = await queries.getActivePosters.all();
        if (existing.length > 0) {
            return res.json({ success: true, message: `Already have ${existing.length} templates, skipping seed.` });
        }

        const sampleTemplates = [
            {
                name: 'Diwali Festival',
                category: 'Festival',
                background_url: 'https://images.unsplash.com/photo-1605810230434-7631ac76ec81?w=800&q=80',
                thumbnail_url: 'https://images.unsplash.com/photo-1605810230434-7631ac76ec81?w=400&q=60',
                overlay_config: { text_color: '#FFD700', font_size: 32 },
                is_active: true,
                sort_order: 1
            },
            {
                name: 'New Year Greeting',
                category: 'Festival',
                background_url: 'https://images.unsplash.com/photo-1467810563316-b5476525c0f9?w=800&q=80',
                thumbnail_url: 'https://images.unsplash.com/photo-1467810563316-b5476525c0f9?w=400&q=60',
                overlay_config: { text_color: '#FFFFFF', font_size: 28 },
                is_active: true,
                sort_order: 2
            },
            {
                name: 'Business Promo',
                category: 'Business',
                background_url: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=800&q=80',
                thumbnail_url: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=400&q=60',
                overlay_config: { text_color: '#FFFFFF', font_size: 26 },
                is_active: true,
                sort_order: 3
            },
            {
                name: 'Sale Offer',
                category: 'Business',
                background_url: 'https://images.unsplash.com/photo-1607082349566-187342175e2f?w=800&q=80',
                thumbnail_url: 'https://images.unsplash.com/photo-1607082349566-187342175e2f?w=400&q=60',
                overlay_config: { text_color: '#FF4444', font_size: 30 },
                is_active: true,
                sort_order: 4
            },
            {
                name: 'Independence Day',
                category: 'National',
                background_url: 'https://images.unsplash.com/photo-1532375810709-75b1da00537c?w=800&q=80',
                thumbnail_url: 'https://images.unsplash.com/photo-1532375810709-75b1da00537c?w=400&q=60',
                overlay_config: { text_color: '#FF9933', font_size: 28 },
                is_active: true,
                sort_order: 5
            },
            {
                name: 'Thank You Card',
                category: 'Social',
                background_url: 'https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=800&q=80',
                thumbnail_url: 'https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=400&q=60',
                overlay_config: { text_color: '#FFFFFF', font_size: 28 },
                is_active: true,
                sort_order: 6
            }
        ];

        for (const tpl of sampleTemplates) {
            await queries.createPoster.run(tpl);
        }

        res.json({ success: true, message: `Seeded ${sampleTemplates.length} sample poster templates!` });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.use('/api/minisite', minisiteRoutes);

// ─── App-facing Routes (used by Android app) ───────────────────
const appAuthRoutes = require('./routes/app-auth');
app.use('/promobot', appAuthRoutes);

// ─── Public Mini Site Page ─────────────────────────────────────
async function renderMiniSite(req, res, next) {
    try {
        const { queries } = require('./database');
        const site = await queries.getMiniSiteBySlug.get(req.params.slug);
        if (!site) {
            if (next) return next();
            return res.status(404).send('<h1>Site not found</h1>');
        }

        const esc = (s) => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        const bName = site.business_name || site.businessName || '';
        const whatsappLink = site.whatsapp ?
            `https://wa.me/${site.whatsapp.replace(/[^0-9]/g, '')}?text=Hi%20${encodeURIComponent(bName)}` : '';
        const mapsLink = site.maps_link || site.mapsLink || '';
        const upiId = site.upi_id || site.upiId || '';

        // Products Grid / fallback to Services
        let productsHtml = '';
        let hasProducts = false;
        try {
            const products = typeof site.products === 'string' ? JSON.parse(site.products) : (site.products || []);
            if (Array.isArray(products) && products.length > 0) {
                hasProducts = true;
                productsHtml = `<div class="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-5">` +
                    products.map(p => `
                        <div class="bg-gray-800 rounded-2xl overflow-hidden border border-gray-700 shadow-md hover:border-blue-500 transition-all group">
                            <div class="aspect-square w-full overflow-hidden bg-gray-900">
                                <img src="${esc(p.image_url)}" alt="${esc(p.name)}" onerror="this.src='/placeholder.jpg';" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300">
                            </div>
                            <div class="p-3">
                                <h3 class="font-semibold text-sm md:text-base text-gray-100 line-clamp-2">${esc(p.name)}</h3>
                                ${p.price ? `<p class="text-blue-400 font-bold text-sm mt-1">₹${esc(p.price)}</p>` : ''}
                            </div>
                        </div>`).join('') + `</div>`;
            }
        } catch (e) { }

        if (!hasProducts && site.services) {
            const serviceItems = site.services.split('\n').filter(s => s.trim())
                .map(s => `<li class="flex items-start gap-3 py-3 border-b border-gray-800 last:border-0">
                    <span class="text-blue-500 shrink-0 mt-0.5"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg></span> 
                    <span class="text-gray-300 leading-relaxed">${esc(s.trim())}</span>
                </li>`).join('');
            if (serviceItems) {
                productsHtml = `<ul class="bg-gray-900/50 rounded-2xl p-4 border border-gray-800 shadow-inner">${serviceItems}</ul>`;
            }
        }

        const logoUrl = site.logo_url || site.logoUrl;
        const bannerUrl = site.banner_url || site.bannerUrl;

        const bannerHtml = bannerUrl
            ? `<div class="w-full h-48 md:h-64 bg-cover bg-center relative" style="background-image: url('${esc(bannerUrl)}')">
                   <div class="absolute inset-0 bg-gradient-to-b from-transparent to-gray-950/90"></div>
               </div>`
            : `<div class="w-full h-40 md:h-56 bg-gradient-to-br from-indigo-900 via-gray-900 to-black relative">
                   <div class="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
               </div>`;

        const logoHtml = logoUrl
            ? `<img src="${esc(logoUrl)}" alt="Logo" class="w-28 h-28 md:w-32 md:h-32 rounded-full border-4 border-gray-950 object-cover shadow-2xl bg-white z-10 relative">`
            : `<div class="w-28 h-28 md:w-32 md:h-32 rounded-full border-4 border-gray-950 bg-gradient-to-tr from-blue-600 to-purple-600 text-white shadow-2xl flex items-center justify-center text-4xl font-bold uppercase z-10 relative">${esc(bName.charAt(0))}</div>`;

        // Custom Links
        let linksHtml = '';
        try {
            const links = typeof site.custom_links === 'string' ? JSON.parse(site.custom_links) : (site.custom_links || []);
            if (Array.isArray(links) && links.length > 0) {
                linksHtml = links.map(l => `
                    <a href="${esc(l.url)}" target="_blank" class="block w-full text-center bg-gray-900 border border-gray-700 hover:border-purple-500 hover:bg-gray-800 text-white font-semibold py-3.5 px-6 rounded-2xl transition-all shadow-md active:scale-[0.98] group relative overflow-hidden">
                        <div class="absolute inset-0 bg-gradient-to-r from-purple-600/10 to-blue-600/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <span class="relative z-10">${esc(l.title)}</span>
                    </a>
                `).join('');
                linksHtml = `<div class="space-y-3 mt-5">${linksHtml}</div>`;
            }
        } catch (e) { }

        // Gallery
        let galleryHtml = '';
        try {
            const gallery = typeof site.gallery === 'string' ? JSON.parse(site.gallery) : (site.gallery || []);
            if (Array.isArray(gallery) && gallery.length > 0) {
                galleryHtml = `
                <section class="glass-panel rounded-3xl p-5 md:p-6 shadow-xl text-center">
                    <h2 class="text-lg font-bold text-white mb-4 flex justify-center items-center gap-2">
                        <svg class="w-5 h-5 text-pink-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                        Gallery
                    </h2>
                    <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        ${gallery.map(g => `<div class="aspect-square rounded-xl overflow-hidden bg-gray-900 border border-gray-800"><img src="${esc(g)}" class="w-full h-full object-cover hover:scale-110 transition-transform duration-500 cursor-pointer" onclick="window.open('${esc(g)}','_blank')"></div>`).join('')}
                    </div>
                </section>`;
            }
        } catch (e) { }

        const currentUrl = `https://promo.mywebz.in/${req.params.slug}`;

        // VCard Generation URL
        const vcardUrl = `/api/minisite/${req.params.slug}/vcard`;

        const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>${esc(bName)} - Promobot</title>
    <meta name="description" content="${esc(site.tagline)}">
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        body { font-family: 'Plus Jakarta Sans', sans-serif; background-color: #030712; color: #f3f4f6; }
        .glass-panel { background: rgba(17, 24, 39, 0.7); backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.05); }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
    </style>
</head>
<body class="antialiased pb-24 selection:bg-blue-500/30">

    <!-- Hero Section -->
    ${bannerHtml}
    
    <div class="max-w-3xl mx-auto px-4 sm:px-6 relative -mt-16 md:-mt-20">
        <div class="flex flex-col items-center text-center">
            ${logoHtml}
            <h1 class="mt-4 text-2xl md:text-3xl font-extrabold tracking-tight text-white">${esc(bName)}
                <svg class="inline-block w-6 h-6 text-blue-500 ml-1 mb-1" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path></svg>
            </h1>
            ${site.tagline ? `<p class="mt-2 text-sm md:text-base text-gray-400 font-medium max-w-lg">${esc(site.tagline)}</p>` : ''}
            
            <a href="${vcardUrl}" class="mt-4 bg-white/10 hover:bg-white/20 text-white border border-white/20 backdrop-blur-md font-semibold py-2 px-6 rounded-full inline-flex items-center gap-2 transition-all active:scale-95 text-sm shadow-[0_0_15px_rgba(255,255,255,0.1)]">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                Save Contact
            </a>
        </div>

        <!-- Action Buttons Scroll -->
        <div class="flex overflow-x-auto no-scrollbar gap-3 py-6 mt-2 justify-start md:justify-center">
            ${site.phone ? `<a href="tel:${site.phone}" class="shrink-0 flex flex-col items-center justify-center w-[72px] h-[72px] rounded-2xl bg-gray-900 border border-gray-800 text-blue-400 hover:bg-gray-800 transition active:scale-95 shadow-md"><svg class="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg><span class="text-[11px] font-semibold tracking-wide">Call</span></a>` : ''}
            
            ${whatsappLink ? `<a href="${whatsappLink}" class="shrink-0 flex flex-col items-center justify-center w-[72px] h-[72px] rounded-2xl bg-gray-900 border border-gray-800 text-green-500 hover:bg-gray-800 transition active:scale-95 shadow-md"><svg class="w-6 h-6 mb-1" fill="currentColor" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.347-.272.297-1.04 1.016-1.04 2.479 0 1.463 1.065 2.876 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/></svg><span class="text-[11px] font-semibold tracking-wide">WhatsApp</span></a>` : ''}
            
            ${mapsLink ? `<a href="${mapsLink}" class="shrink-0 flex flex-col items-center justify-center w-[72px] h-[72px] rounded-2xl bg-gray-900 border border-gray-800 text-red-500 hover:bg-gray-800 transition active:scale-95 shadow-md"><svg class="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg><span class="text-[11px] font-semibold tracking-wide">Maps</span></a>` : ''}
            
            ${site.email ? `<a href="mailto:${site.email}" class="shrink-0 flex flex-col items-center justify-center w-[72px] h-[72px] rounded-2xl bg-gray-900 border border-gray-800 text-purple-400 hover:bg-gray-800 transition active:scale-95 shadow-md"><svg class="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg><span class="text-[11px] font-semibold tracking-wide">Email</span></a>` : ''}

            <a href="#share-section" class="shrink-0 flex flex-col items-center justify-center w-[72px] h-[72px] rounded-2xl bg-gray-900 border border-gray-800 text-yellow-500 hover:bg-gray-800 transition active:scale-95 shadow-md"><svg class="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"></path></svg><span class="text-[11px] font-semibold tracking-wide">Share</span></a>
        </div>

        ${linksHtml}

        <div class="space-y-6 mt-6">
            ${galleryHtml}
            <!-- Services / Products -->
            ${productsHtml ? `
            <section class="glass-panel rounded-3xl p-5 md:p-6 shadow-xl">
                <h2 class="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <svg class="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path></svg>
                    Our Catalog
                </h2>
                ${productsHtml}
            </section>
            ` : ''}

            <!-- Info & Contact -->
            <section class="glass-panel rounded-3xl p-5 md:p-6 shadow-xl space-y-4 text-sm text-gray-300">
                <h2 class="text-lg font-bold text-white mb-2 flex items-center gap-2">
                    <svg class="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    Contact Information
                </h2>
                ${site.phone ? `<div class="flex items-center gap-4 bg-gray-900/50 p-3 inset-0 rounded-xl border border-gray-800"><div class="p-2 bg-blue-500/10 text-blue-400 rounded-lg"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg></div><div><p class="text-xs text-gray-500 uppercase font-semibold">Phone Number</p><a href="tel:${site.phone}" class="font-medium text-white block mt-0.5">${site.phone}</a></div></div>` : ''}
                
                ${site.address ? `<div class="flex items-start gap-4 bg-gray-900/50 p-3 inset-0 rounded-xl border border-gray-800"><div class="p-2 bg-red-500/10 text-red-400 rounded-lg shrink-0"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg></div><div><p class="text-xs text-gray-500 uppercase font-semibold">Location</p><p class="font-medium text-white leading-snug mt-1">${esc(site.address)}</p></div></div>` : ''}
            </section>

            <!-- Google Business Review -->
            ${mapsLink ? `
            <section class="glass-panel rounded-3xl p-5 md:p-6 shadow-xl text-center">
                <div class="flex justify-center items-center gap-1 mb-3 text-yellow-400">
                    <svg class="w-6 h-6 fill-current" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                    <svg class="w-6 h-6 fill-current" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                    <svg class="w-6 h-6 fill-current" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                    <svg class="w-6 h-6 fill-current" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                    <svg class="w-6 h-6 fill-current" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                </div>
                <h2 class="text-xl font-bold text-white mb-2">Love our service?</h2>
                <p class="text-sm text-gray-400 mb-5">Your feedback helps us grow and serve you better.</p>
                <a href="${mapsLink}" target="_blank" class="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-3 px-8 rounded-full shadow-lg transition-transform active:scale-95">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"></path></svg>
                    Rate us on Google
                </a>
            </section>
            ` : ''}

            <!-- Payment -->
            ${upiId ? `
            <section class="glass-panel rounded-3xl p-5 shadow-xl text-center">
                <h2 class="text-lg font-bold text-white mb-2 flex justify-center items-center gap-2">
                    <svg class="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    Secure Payment
                </h2>
                <p class="text-sm text-gray-400 mb-4">You can complete your payment securely via UPI ID</p>
                <div class="inline-flex items-center gap-3 bg-gradient-to-r from-gray-900 to-gray-800 px-6 py-3 rounded-2xl border border-green-500/30">
                    <span class="text-green-400 font-bold tracking-wide">${esc(upiId)}</span>
                    <button onclick="navigator.clipboard.writeText('${esc(upiId)}'); alert('UPI ID Copied!');" class="p-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 transition">
                        <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                    </button>
                </div>
            </section>
            ` : ''}

            <!-- Bottom Margin to ensure sticky footer doesn't overlap content -->
            <div id="share-section" class="h-10"></div>
        </div>
    </div>

    <!-- Sticky Share Footer -->
    <div class="fixed bottom-0 left-0 w-full glass-panel border-t border-gray-800 shadow-[0_-10px_30px_rgba(0,0,0,0.5)] z-50 p-3 sm:px-6 flex justify-center fade-in">
        <div class="flex items-center gap-2 w-full max-w-lg mx-auto">
            <input type="tel" id="shareMobileInput" placeholder="Enter Mobile to Share..." 
                class="flex-1 bg-gray-900 border border-gray-700 text-white text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 transition-colors shadow-inner" >
            <button onclick="shareLink()" class="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold px-5 py-3 rounded-xl shadow-lg transition-transform active:scale-95 flex items-center gap-2">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
                Share
            </button>
        </div>
    </div>

    <!-- Script to handle WhatsApp Sharing -->
    <script>
        function shareLink() {
            const num = document.getElementById('shareMobileInput').value.replace(/[^0-9]/g, '');
            if (num.length < 10) {
                alert('Please enter a valid mobile number.');
                return;
            }
            // If length is 10, prepend generic country code (91 for India), else assume code attached
            const fullNum = num.length === 10 ? '91' + num : num;
            const text = encodeURIComponent("Check out my Mini Website:\\n${esc(currentUrl)}");
            window.open('https://api.whatsapp.com/send/?phone=' + fullNum + '&text=' + text, '_blank');
        }
    </script>
</body>
</html>`;

        res.setHeader('Content-Type', 'text/html');
        res.send(html);
    } catch (err) {
        if (next) return next();
        res.status(500).send('<h1>Error</h1><p>' + err.message + '</p>');
    }
}

// Bind old app route for backward compatibility
app.get('/site/:slug', (req, res) => renderMiniSite(req, res));

// ─── Serve frontend ────────────────────────────────────────────
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Root-level Mini Site wildcard route (must be evaluated last to not break other routes)
app.get('/:slug', (req, res, next) => renderMiniSite(req, res, next));

// ─── Start server ──────────────────────────────────────────────
app.listen(PORT, () => {
    console.log('');
    console.log('╔══════════════════════════════════════════╗');
    console.log('║   Promobot — Admin Panel (Supabase)      ║');
    console.log('╠══════════════════════════════════════════╣');
    console.log(`║   🌐 http://localhost:${PORT}              ║`);
    console.log('║   👤 Admin: admin / M112233M             ║');
    console.log('║                                          ║');
    console.log('║   App Endpoints:                         ║');
    console.log(`║   POST /promobot/login                   ║`);
    console.log(`║   GET  /promobot/validate                ║`);
    console.log(`║   GET  /promobot/posters                 ║`);
    console.log('╚══════════════════════════════════════════╝');
    console.log('');
});

module.exports = app;
