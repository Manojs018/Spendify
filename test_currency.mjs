import http from 'http';

const loginData = JSON.stringify({ email: 'finaltest_verify@example.com', password: 'StrongPass@123' });

const loginReq = http.request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/login',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(loginData)
    }
}, (res) => {
    let raw = '';
    res.on('data', c => raw += c);
    res.on('end', () => {
        let token = null;
        try {
            const data = JSON.parse(raw);
            token = data.data?.token;
        } catch(e) {}
        
        if (!token) {
            console.error('Login failed:', raw);
            return;
        }
        
        console.log('Login OK, token obtained.');

        // Test 1: GET /api/auth/me
        const getMe = http.request({
            hostname: 'localhost',
            port: 5000,
            path: '/api/auth/me',
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        }, (r1) => {
            let d1 = '';
            r1.on('data', c => d1 += c);
            r1.on('end', () => {
                console.log(`\nGET /api/auth/me => Status: ${r1.statusCode}`);
                const parsed = JSON.parse(d1);
                console.log('baseCurrency currently:', parsed.data?.baseCurrency);

                // Test 2: PATCH /api/auth/me/currency
                const body = JSON.stringify({ baseCurrency: 'INR' });
                const patchReq = http.request({
                    hostname: 'localhost',
                    port: 5000,
                    path: '/api/auth/me/currency',
                    method: 'PATCH',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                        'Content-Length': Buffer.byteLength(body)
                    }
                }, (r2) => {
                    let d2 = '';
                    r2.on('data', c => d2 += c);
                    r2.on('end', () => {
                        console.log(`\nPATCH /api/auth/me/currency => Status: ${r2.statusCode}`);
                        console.log('Response:', d2.substring(0, 300));
                    });
                });
                patchReq.write(body);
                patchReq.end();
            });
        });
        getMe.end();
    });
});
loginReq.write(loginData);
loginReq.end();
