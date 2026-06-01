import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// --- DROŠĪBAS MIDDLWARE (Pārnests no tavas Cloudflare functions/_middleware.js) ---
app.use((req, res, next) => {
    // Tava pilnā CSP politika
    res.setHeader(
        'Content-Security-Policy',
        "default-src 'none'; script-src 'self' https://cdn.jsdelivr.net chrome-extension:; connect-src 'self' https: wss: chrome-extension:; img-src 'self' data: https: blob:; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; media-src 'self' blob:; video-src 'self' blob:; object-src 'none'; frame-ancestors 'none'; form-action 'self'; base-uri 'self'; manifest-src 'self'; worker-src 'self' blob:; upgrade-insecure-requests;"
    );

    // Pārējās drošības galvenes no tava faila
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), camera=(), microphone=()');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

    next();
});
// ---------------------------------------------------------------------------------

// Automātiski ielādējam API maršrutus no tavas "functions/api" mapes
const apiDir = path.join(__dirname, 'functions', 'api');

async function walkRoutes(dir, routePrefix = '/api') {
    if (!fs.existsSync(dir)) return;

    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            await walkRoutes(fullPath, `${routePrefix}/${file}`);
        } else if (file.endsWith('.js')) {
            const routeName = file === 'index.js' ? '' : `/${file.slice(0, -3)}`;
            const fullRoute = `${routePrefix}${routeName}`;
            
            try {
                const fileUrl = new URL(`file://${fullPath}`).href;
                const handlerModule = await import(fileUrl);
                const handler = handlerModule.default || handlerModule;

                app.all(fullRoute, (req, res) => {
                    if (typeof handler === 'function') {
                        handler(req, res);
                    } else {
                        res.status(500).send('API handler nav atrasts vai nav funkcija');
                    }
                });
                console.log(`Reģistrēts maršruts: ${fullRoute}`);
            } catch (e) {
                console.error(`Kļūda ielādējot maršrutu ${fullRoute}:`, e);
            }
        }
    }
}

await walkRoutes(apiDir);

// Servējam tavu frontend daļu no "public" mapes
app.use(express.static(path.join(__dirname, 'public')));

// Ja klients pieprasa jebko citu, nosūtām index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Serveris aktīvs uz porta ${PORT}`);
});
