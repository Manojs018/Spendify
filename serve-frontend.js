// Simple HTTP Server for Spendify Frontend
// Run with: node serve-frontend.js

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const CLIENT_DIR = path.join(__dirname, 'client');

const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
    // Strip query strings
    const urlPath = req.url.split('?')[0];
    console.log(`${req.method} ${urlPath}`);

    // Build candidate file paths to try in order:
    // 1. Exact path (e.g. /index.html, /css/auth.css)
    // 2. Path + .html  (e.g. /dashboard  →  /dashboard.html)
    // 3. Fallback to index.html (SPA catch-all)
    const candidates = [
        path.join(CLIENT_DIR, urlPath === '/' ? '/index.html' : urlPath),
        path.join(CLIENT_DIR, urlPath + '.html'),
        path.join(CLIENT_DIR, 'index.html'),
    ];

    function tryNext(i) {
        if (i >= candidates.length) {
            res.writeHead(404, { 'Content-Type': 'text/html' });
            res.end('<h1>404 - File Not Found</h1>', 'utf-8');
            return;
        }

        const filePath = candidates[i];
        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'text/html';

        fs.readFile(filePath, (err, content) => {
            if (err) {
                // If file not found, try next candidate
                if (err.code === 'ENOENT') {
                    tryNext(i + 1);
                } else {
                    res.writeHead(500);
                    res.end(`Server Error: ${err.code}`, 'utf-8');
                }
            } else {
                res.writeHead(200, { 'Content-Type': contentType });
                res.end(content, 'utf-8');
            }
        });
    }

    tryNext(0);
});

server.listen(PORT, () => {
    console.log('\n========================================');
    console.log('  🟦 SPENDIFY - Frontend Server');
    console.log('========================================\n');
    console.log(`✅ Server running at: http://localhost:${PORT}`);
    console.log(`📁 Serving files from: ${CLIENT_DIR}`);
    console.log('\n📝 Next Steps:');
    console.log('  1. Make sure backend is running on port 5000');
    console.log('  2. Open: http://localhost:3000');
    console.log('  3. Register and login to explore!\n');
    console.log('Press Ctrl+C to stop the server\n');
    console.log('========================================\n');
});
