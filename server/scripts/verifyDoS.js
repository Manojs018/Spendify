
import { execFileSync } from 'child_process';

const BASE = 'http://localhost:5000/api';
const BYPASS = 'spendify-dev-test-bypass';

function test(method, path, body = null) {
    const args = [
        '-s',
        '-X', method,
        '-H', 'Content-Type: application/json',
        '-H', `X-Test-Bypass: ${BYPASS}`,
        '-w', '\nHTTP_STATUS:%{http_code}\n',
    ];
    if (body) args.push('-d', JSON.stringify(body));
    args.push(`${BASE}${path}`);

    try {
        const out = execFileSync('curl.exe', args, { encoding: 'utf8' });
        console.log(`URL: ${path}`);
        console.log(`RES: ${out.split('\n')[0]}`); // First line of JSON
        const status = out.match(/HTTP_STATUS:(\d+)/)?.[1];
        console.log(`STATUS: ${status}`);
        return status;
    } catch (e) {
        console.error(`ERROR: ${e.message}`);
        return null;
    }
}

async function run() {
    console.log('--- PAGINATION DOS VERIFICATION ---\n');

    console.log('1. Testing /transactions oversized limit (limit=101)');
    test('GET', '/transactions?limit=101');

    console.log('\n2. Testing /transactions invalid page (page=0)');
    test('GET', '/transactions?page=0');

    console.log('\n3. Testing /transfer/history oversized limit (limit=999)');
    test('GET', '/transfer/history?limit=999');

    console.log('\n4. Testing /transfer/history negative page (page=-5)');
    test('GET', '/transfer/history?page=-5');

    console.log('\n5. Testing /transactions valid pagination (page=1, limit=10)');
    test('GET', '/transactions?page=1&limit=10');

    console.log('\nFINISHED.');
}

run();
