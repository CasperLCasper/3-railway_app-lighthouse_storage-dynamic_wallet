import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import multer from 'multer';

// Nodrošinām, ka Node.js vidē ir pieejami globālie File un Blob (ja vecāka versija)
if (!globalThis.File) {
    const { File, Blob } = await import('node:buffer');
    globalThis.File = File;
    globalThis.Blob = Blob;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Konfigurējam multer failu saglabāšanai atmiņā (Buffer) līdz 50MB
const upload = multer({ limits: { fileSize: 50 * 1024 * 1024 } });

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// --- DROŠĪBAS MIDDLWARE (CSP) ---
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

// --- CLOUDFLARE -> EXPRESS ADAPTERIS AR PILNU FORM-DATA UN FILE ATBALSTU ---
function createCloudflareAdapter(handler) {
    return async (req, res) => {
        try {
            const headersEmulator = {
                ...req.headers,
                get: (headerName) => {
                    const name = headerName.toLowerCase();
                    return req.headers[name] || null;
                }
            };

            const context = {
                env: process.env, 
                request: {
                    json: async () => req.body,
                    // Emulējam Cloudflare context.request.formData() ar īstām File instancēm
                    formData: async () => {
                        const formData = new Map();
                        
                        // Apstrādājam failus no multer
                        if (req.files && Array.isArray(req.files)) {
                            req.files.forEach(file => {
                                // Izveidojam autentisku globālo File objektu, ko pieprasa "instanceof File" pārbaude
                                const fileInstance = new File([file.buffer], file.originalname, { type: file.mimetype });
                                formData.set(file.fieldname, fileInstance);
                            });
                        } else if (req.file) {
                            const fileInstance = new File([req.file.buffer], req.file.originalname, { type: req.file.mimetype });
                            formData.set(req.file.fieldname, fileInstance);
                        }

                        // Pievienojam parastos teksta laukus, ja tādi ir atsūtīti
                        if (req.body) {
                            Object.keys(req.body).forEach(key => {
                                formData.set(key, req.body[key]);
                            });
                        }

                        // Pievienojam .get() metodi, lai emulētu FormData klasi
                        formData.get = (key) => formData.get(key);
                        
                        return formData;
                    },
                    url: `${req.protocol}://${req.get('host')}${req.originalUrl}`,
                    headers: headersEmulator
                },
                params: req.params
            };

            const cfResponse = await handler(context);

            if (cfResponse && (cfResponse instanceof Response || typeof cfResponse.json === 'function')) {
                res.status(cfResponse.status || 200);
                
                if (cfResponse.headers && typeof cfResponse.headers.forEach === 'function') {
                    cfResponse.headers.forEach((value, key) => {
                        res.setHeader(key, value);
                    });
                } else {
                    res.setHeader('Content-Type', 'application/json');
                }

                try {
                    const jsonBuffer = await cfResponse.json();
                    return res.json(jsonBuffer);
                } catch {
                    const textBuffer = await cfResponse.text();
                    return res.send(textBuffer);
                }
            } 
            
            if (cfResponse && typeof cfResponse === 'object') {
                return res.json(cfResponse);
            }

            res.status(200).end();
        } catch (err) {
            console.error(`Kļūda adapterī izpildot maršrutu:`, err);
            res.status(500).json({ error: "Internal Server Error", message: err.message });
        }
    };
}

// Automātiski ielādējam API maršrutus
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
                
                const getHandler = module.onRequestGet || module.onRequestGET || module.onrequestget;
                const postHandler = module.onRequestPost || module.onRequestPOST || module.onrequestpost;
                const genericHandler = module.onRequest || module.onRequestGeneric;
                const defaultHandler = module.default;

                // Visur, kur ir POST pieprasījumi, ļaujam multer uztvert failus
                if (getHandler) {
                    app.get(fullRoute, createCloudflareAdapter(getHandler));
                }
                if (postHandler) {
                    app.post(fullRoute, upload.any(), createCloudflareAdapter(postHandler));
                }
                if (genericHandler) {
                    app.all(fullRoute, upload.any(), createCloudflareAdapter(genericHandler));
                }
                if (defaultHandler && !getHandler && !postHandler && !genericHandler) {
                    app.all(fullRoute, upload.any(), defaultHandler);
                }

                console.log(`Reģistrēts maršruts: ${fullRoute}`);
            } catch (e) {
                console.error(`Kļūda ielādējot maršrutu ${fullRoute}:`, e);
            }
        }
    }
}

await walkRoutes(apiDir);

app.use(express.static(path.join(__dirname, 'public')));

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Serveris aktīvs uz porta ${PORT}`);
});
