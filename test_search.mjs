import http from 'http';

const loginData = JSON.stringify({ email: 'finaltest_verify@example.com', password: 'StrongPass@123' });

const loginReq = http.request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/login',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': loginData.length
    }
}, (res) => {
    let raw = '';
    res.on('data', c => raw += c);
    res.on('end', () => {
        let token = null;
        try {
            const data = JSON.parse(raw);
            token = data.data.token;
        } catch(e) {}
        
        if (!token) {
            console.error('Login failed:', raw);
            return;
        }
        
        const req = http.request({
            hostname: 'localhost',
            port: 5000,
            path: '/api/transactions?search=Groc',
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        }, (res2) => {
            let data2 = '';
            res2.on('data', chunk => data2 += chunk);
            res2.on('end', () => {
                console.log(`Status: ${res2.statusCode}`);
                console.log(data2);
            });
        });
        req.end();
    });
});
loginReq.write(loginData);
loginReq.end();
