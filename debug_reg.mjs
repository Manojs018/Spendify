
import http from 'http';

const data = JSON.stringify({
    name: 'Debug',
    email: `debug_${Date.now()}@test.com`,
    password: 'Password123!Ab'
});

const options = {
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/register',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length,
        'X-Test-Bypass': 'spendify-dev-test-bypass'
    }
};

const start = Date.now();
const req = http.request(options, (res) => {
    console.log('STATUS:', res.statusCode);
    res.on('data', (d) => {
        process.stdout.write(d);
    });
    res.on('end', () => {
        console.log('\nTIME:', Date.now() - start, 'ms');
        process.exit(0);
    });
});

req.on('error', (e) => {
    console.error(e);
    process.exit(1);
});

req.write(data);
req.end();
