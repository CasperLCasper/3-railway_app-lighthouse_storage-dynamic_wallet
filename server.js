import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Svarīgi: palielinām limitus, ja caur API tiek sūtīti lielāki faili/attēli
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// --- DROŠĪBAS MIDDLWARE (CSP un citas galvenes) ---
app.use((req, res, next) => {
    res.setHeader(
        'Content-Security-Policy',
        "default-src 'none'; script-src 'self' https://cdn.jsdelivr.net chrome-extension:; connect-src 'self' https: wss: chrome-extension:; img-src 'self' data: https: blob:; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; media-src 'self' blob:; video-src 'self' blob:; object-src 'none'; frame-ancestors 'none'; form-action 'self'; base-uri 'self'; manifest-src 'self'; worker-src 'self' blob:; upgrade-insecure-requests;"
    );
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), camera=(), microphone=()');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    next();
});

// --- AUTOMĀTISKAIS CLOUDFLARE -> EXPRESS ADAPTERIS ---
function createCloudflareAdapter(handler, methodType) {
    return async (req, res) => {
        try {
            // Sagatavojam imitētu Cloudflare "context" objektu
            const context = {
                env: process.env, // Pārvirzām Railway mainīgos uz context.env
                request: {
                    // Imitējam context.request.json()
                    json: async () => req.body,
                    // Imitējam context.request.url un meklēšanas parametrus
                    url: `${req.protocol}://${req.get('host')}${req.originalUrl}`,
                    headers: req.headers
                },
                params: req.params
            };

            // Izsaucam Cloudflare funkciju (piemēram, onRequestGet vai onRequestPost)
            const cfResponse = await handler(context);

            // Ja funkcija atgriež standarta Cloudflare Response objektu
            if (cfResponse instanceof Response) {
                const contentType = cfResponse.headers.get('content-type') || '';
                res.status(cfResponse.status);
                
                // Saliekam atpakaļ galvenes
                cfResponse.headers.forEach((value, key) => {
                    res.setHeader(key, value);
                });

                if (contentType.includes('application/json')) {
                    const jsonBuffer = await cfResponse.json();
                    return res.json(jsonBuffer);
                } else {
                    const textBuffer = await cfResponse.text();
                    return res.send(textBuffer);
                }
            } 
            
            // Ja funkcija jau ir bijusi modificēta kā parasts eksports
            if (typeof cfResponse === 'object') {
                return res.json(cfResponse);
            }

            res.status(200).end();
        } catch (err) {
            console.error(`Kļūda adapterī izpildot maršrutu:`, err);
            res.status(500).json({ error: "Internal Server Error", message: err.message });
        }
    };
}

// Automātiski ielādējam API maršrutus no "functions/api" mapes
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
                const module = await import(fileUrl);
                
                // Pārbaudām, kādas funkcijas fails eksportē (Cloudflare stils)
                const hasGet = typeof module.onRequestGet === 'function';
                const hasPost = typeof module.onRequestPost === 'function';
                const hasGeneric = typeof module.onRequest === 'function';
                const hasDefault = typeof module.default === 'function';

                if (hasGet) {
                    app.get(fullRoute, createCloudflareAdapter(module.onRequestGet, 'GET'));
                }
                if (hasPost) {
                    app.post(fullRoute, createCloudflareAdapter(module.onRequestPost, 'POST'));
                }
                if (hasGeneric) {
                    app.all(fullRoute, createCloudflareAdapter(module.onRequest, 'ALL'));
                }
                if (hasDefault && !hasGet && !hasPost && !hasGeneric) {
                    // Ja tas ir parastais Express noklusējuma handleris (kā mūsu labotie login/nonce)
                    app.all(fullRoute, module.default);
                }

                console.log(`Reģistrēts maršruts: ${fullRoute}`);
            } catch (e) {
                console.error(`Kļūda ielādējot maršrutu ${fullRoute}:`, e);
            }
        }
    }
}

await walkRoutes(apiDir);

// Servējam frontend daļu no "public" mapes
app.use(express.static(path.join(__dirname, 'public')));

// Ja klients pieprasa jebko citu, nosūtām index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Serveris aktīvs uz porta ${PORT}`);
});
