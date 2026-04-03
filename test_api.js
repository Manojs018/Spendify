const run = async () => {
    const email = `UPPERCASE.${Date.now()}@Example.com`;
    const password = 'Password321!';
    
    // Get CSRF Token
    let csrfToken = ''; let cookie = '';
    const csrfRes = await fetch('http://localhost:5000/api/csrf-token');
    const csrfData = await csrfRes.json();
    csrfToken = csrfData.csrfToken;
    cookie = csrfRes.headers.get('set-cookie');

    const headers = { 
        'Content-Type': 'application/json',
        'X-XSRF-TOKEN': csrfToken,
        'Cookie': cookie
    };

    // Register
    const regRes = await fetch('http://localhost:5000/api/auth/register', {
        method: 'POST',
        headers,
        body: JSON.stringify({ name: 'Test', email, password })
    });
    console.log('Register:', regRes.status, await regRes.text());
    
    // Login
    const loginRes = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers,
        body: JSON.stringify({ email, password })
    });
    console.log('Login:', loginRes.status, await loginRes.text());
};
run().catch(console.error);
