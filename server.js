const express = require('express');
const cors = require('cors');
const path = require('path');

// Initialize database (creates tables + seeds admin)
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

app.use('/api/auth', adminRoutes);
app.use('/api/dashboard', authMiddleware, (req, res) => {
    // Forward to admin dashboard handler
    const admin = require('./routes/admin');
    // Direct call to dashboard stats
    const { queries } = require('./database');
    try {
        const totalUsers = queries.getUserCount.get().count;
        const activeUsers = queries.getActiveUserCount.get().count;
        const activeLicenses = queries.getActiveLicenseCount.get().count;
        const expiredLicenses = queries.getExpiredLicenseCount.get().count;
        const unusedKeys = queries.getUnusedKeyCount.get().count;
        const recentLicenses = queries.getRecentLicenses.all();
        res.json({
            success: true,
            stats: { totalUsers, activeUsers, activeLicenses, expiredLicenses, unusedKeys, recentLicenses }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});
app.use('/api/users', authMiddleware, userRoutes);
app.use('/api/keys', authMiddleware, keyRoutes);

// ─── App-facing Routes (used by Android app) ───────────────────
const appAuthRoutes = require('./routes/app-auth');
app.use('/digitalvictory', appAuthRoutes);

// ─── Serve frontend ────────────────────────────────────────────
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── Start server ──────────────────────────────────────────────
app.listen(PORT, () => {
    console.log('');
    console.log('╔══════════════════════════════════════════╗');
    console.log('║   Digital Victory Advertisement — Admin Panel    ║');
    console.log('╠══════════════════════════════════════════╣');
    console.log(`║   🌐 http://localhost:${PORT}              ║`);
    console.log('║   👤 Admin: admin / admin123             ║');
    console.log('║                                          ║');
    console.log('║   App Endpoints:                         ║');
    console.log(`║   POST /digitalvictory/login             ║`);
    console.log(`║   GET  /digitalvictory/validate          ║`);
    console.log('╚══════════════════════════════════════════╝');
    console.log('');
});

module.exports = app;
