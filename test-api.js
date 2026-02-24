const http = require('http');

function test(path, method, body) {
    return new Promise((resolve) => {
        const data = body ? JSON.stringify(body) : '';
        const opts = {
            hostname: 'localhost', port: 3000, path, method,
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
        };
        const req = http.request(opts, (res) => {
            let b = '';
            res.on('data', c => b += c);
            res.on('end', () => {
                console.log(`\n[${method} ${path}] → ${res.statusCode}`);
                try { console.log(JSON.stringify(JSON.parse(b), null, 2)); }
                catch { console.log(b); }
                resolve(JSON.parse(b));
            });
        });
        req.on('error', e => { console.log('ERROR:', e.message); resolve(null); });
        if (data) req.write(data);
        req.end();
    });
}

async function run() {
    // 1. Admin Login
    console.log('=== TEST 1: Admin Login ===');
    const login = await test('/api/auth/login', 'POST', { username: 'admin', password: 'admin123' });

    if (!login || !login.success) { console.log('FAILED: Admin login failed'); return; }
    const token = login.token;

    // 2. Dashboard Stats
    console.log('\n=== TEST 2: Dashboard Stats ===');
    const dashOpts = {
        hostname: 'localhost', port: 3000, path: '/api/dashboard', method: 'GET',
        headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }
    };
    await new Promise(resolve => {
        http.request(dashOpts, res => {
            let b = '';
            res.on('data', c => b += c);
            res.on('end', () => { console.log('[GET /api/dashboard] →', res.statusCode); console.log(JSON.stringify(JSON.parse(b), null, 2)); resolve(); });
        }).end();
    });

    // 3. Generate Key
    console.log('\n=== TEST 3: Generate Activation Key ===');
    await new Promise(resolve => {
        const data = JSON.stringify({ count: 2, plan_name: 'Pro', duration_days: 90 });
        const opts = {
            hostname: 'localhost', port: 3000, path: '/api/keys/generate', method: 'POST',
            headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
        };
        const req = http.request(opts, res => {
            let b = '';
            res.on('data', c => b += c);
            res.on('end', () => { console.log('[POST /api/keys/generate] →', res.statusCode); console.log(JSON.stringify(JSON.parse(b), null, 2)); resolve(); });
        });
        req.write(data);
        req.end();
    });

    // 4. App Login (new user with key)
    console.log('\n=== TEST 4: App Login (new user) ===');
    // First get a key
    const keysRes = await new Promise(resolve => {
        http.request({
            hostname: 'localhost', port: 3000, path: '/api/keys', method: 'GET',
            headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }
        }, res => {
            let b = '';
            res.on('data', c => b += c);
            res.on('end', () => resolve(JSON.parse(b)));
        }).end();
    });

    const unusedKey = keysRes.keys.find(k => !k.is_used && !k.is_revoked);
    if (unusedKey) {
        const appLogin = await test('/digitalvictory/login', 'POST', {
            username: 'testuser1', password: 'pass123', activationKey: unusedKey.key_value, deviceId: 'test-device-001'
        });

        // 5. Validate the token
        if (appLogin && appLogin.token) {
            console.log('\n=== TEST 5: Validate License Token ===');
            await new Promise(resolve => {
                http.request({
                    hostname: 'localhost', port: 3000, path: '/digitalvictory/validate', method: 'GET',
                    headers: { 'Authorization': 'Bearer ' + appLogin.token, 'Content-Type': 'application/json' }
                }, res => {
                    let b = '';
                    res.on('data', c => b += c);
                    res.on('end', () => { console.log('[GET /digitalvictory/validate] →', res.statusCode); console.log(JSON.stringify(JSON.parse(b), null, 2)); resolve(); });
                }).end();
            });
        }
    }

    console.log('\n=== ALL TESTS COMPLETE ===');
}

run();
