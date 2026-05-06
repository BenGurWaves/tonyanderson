#!/usr/bin/env node
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3001;
const ROOT = __dirname;

const MIME = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.webp': 'image/webp',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.mp3': 'audio/mpeg',
    '.ogg': 'audio/ogg',
    '.woff2': 'font/woff2',
    '.woff': 'font/woff',
};

const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent(req.url.split('?')[0]);
    let filePath = path.join(ROOT, urlPath === '/' ? 'index.html' : urlPath);

    // Resolve directory to index.html
    try {
        if (fs.statSync(filePath).isDirectory()) {
            filePath = path.join(filePath, 'index.html');
        }
    } catch (e) {
        // file doesn't exist
        res.writeHead(404);
        res.end('404');
        return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME[ext] || 'application/octet-stream';

    // --- Range request support (critical for video/audio seeking) ---
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range && (ext === '.mp4' || ext === '.webm' || ext === '.mp3' || ext === '.ogg')) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunkSize = end - start + 1;

        res.writeHead(206, {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunkSize,
            'Content-Type': contentType,
        });

        fs.createReadStream(filePath, { start, end }).pipe(res);
    } else {
        res.writeHead(200, {
            'Content-Length': fileSize,
            'Content-Type': contentType,
        });
        fs.createReadStream(filePath).pipe(res);
    }
});

server.listen(PORT, () => {
    console.log(`\n  ◈  Tony Anderson — The Dissolving Theater`);
    console.log(`     http://localhost:${PORT}/`);
    console.log(`\n     Press Ctrl+C to stop.\n`);
});
