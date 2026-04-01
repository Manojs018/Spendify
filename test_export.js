import fs from 'fs';

async function testExport() {
  // get csrf
  const csrfInit = await fetch('http://localhost:5000/api/csrf-token');
  const csrfData = await csrfInit.json();
  const csrfToken = csrfData.csrfToken;

  const getCookie = (res, name) => {
    const cookies = res.headers.get('set-cookie');
    if (!cookies) return null;
    const match = cookies.match(new RegExp(`${name}=([^;]+)`));
    return match ? match[1] : null;
  };
  const csrfCookie = getCookie(csrfInit, 'csrfToken');

  const timestamp = Date.now();
  const userData = { name: `Test ${timestamp}`, email: `test${timestamp}@example.com`, password: 'Password123!' };
  console.log('Registering user...');
  const res = await fetch('http://localhost:5000/api/auth/register', {
    method: 'POST',
    headers: { 
        'Content-Type': 'application/json',
        'x-csrf-token': csrfToken,
        'Cookie': `csrfToken=${csrfCookie}`
    },
    body: JSON.stringify(userData)
  });
  const textBody = await res.text();
  let data;
  try {
     data = JSON.parse(textBody);
  } catch(e) {}
  const token = data?.token;
  console.log('Registered, token:', token);
  
  if (!token) return console.log('No token, registration failed', textBody);

  console.log('Adding transactions...');
  await fetch('http://localhost:5000/api/transactions', {
    method: 'POST',
    headers: { 
        'Content-Type': 'application/json', 
        'Authorization': `Bearer ${token}`,
        'x-csrf-token': csrfToken,
        'Cookie': `csrfToken=${csrfCookie}`
    },
    body: JSON.stringify({ amount: 1000, type: 'income', category: 'Salary', description: 'Month salary', date: new Date().toISOString() })
  });
  
  await fetch('http://localhost:5000/api/transactions', {
    method: 'POST',
    headers: { 
        'Content-Type': 'application/json', 
        'Authorization': `Bearer ${token}`,
        'x-csrf-token': csrfToken,
        'Cookie': `csrfToken=${csrfCookie}`
    },
    body: JSON.stringify({ amount: 50, type: 'expense', category: 'Food & Dining', description: 'Lunch', date: new Date().toISOString() })
  });

  console.log('Exporting transactions...');
  const expRes = await fetch('http://localhost:5000/api/transactions/export?type=expense', {
    method: 'GET',
    headers: { 
        'Authorization': `Bearer ${token}`,
        'x-csrf-token': csrfToken,
        'Cookie': `csrfToken=${csrfCookie}`
    }
  });
  
  const text = await expRes.text();
  console.log('Export response status:', expRes.status);
  console.log('Export response text:', text);
  fs.writeFileSync('test_export.csv', text);
}

testExport();
