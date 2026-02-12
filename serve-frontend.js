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
    console.log(`${req.method} ${req.url}`);

    // Default to index.html for root
    let filePath = req.url === '/' ? '/index.html' : req.url;
    filePath = path.join(CLIENT_DIR, filePath);

    // Get file extension
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    // Read and serve file
    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/html' });
                res.end('<h1>404 - File Not Found</h1>', 'utf-8');
            } else {
                res.writeHead(500);
                res.end(`Server Error: ${err.code}`, 'utf-8');
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
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
