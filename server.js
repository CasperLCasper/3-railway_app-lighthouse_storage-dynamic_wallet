import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Nodrošinām globālos File un Blob objektus Node.js vidē
if (!globalThis.File) {
    const { File, Blob } = await import('node:buffer');
    globalThis.File = File;
    globalThis.Blob = Blob;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Standarta JSON un URL apstrāde lieliem failiem
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Īpašs buferis, kas uztvers multipart/form-data (failus) bez multer bibliotēkas
app.use((req, res, next) => {
    if (req.headers['content-type'] && req.headers['content-type'].includes('multipart/form-data')) {
        let data = [];
        req.on('data', chunk => data.push(chunk));
        req.on('end', () => {
            req.rawBody = Buffer.concat(data);
            next();
        });
    } else {
        next();
    }
});

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

// --- CLOUDFLARE -> EXPRESS ADAPTERIS (IEBŪVĒTĀ PARSĒŠANA) ---
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
                    formData: async () => {
                        const formData = new Map();
                        
                        // Ja mums ir rawBody no multipart pieprasījuma, izvelkam failu
                        if (req.rawBody) {
                            const contentType = req.headers['content-type'];
                            const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
                            
                            if (boundaryMatch) {
                                const boundary = boundaryMatch[1] || boundaryMatch[2];
                                const bufferStr = req.rawBody.toString('binary');
                                const parts = bufferStr.split('--' + boundary);
                                
                                for (const part of parts) {
                                    if (part.includes('filename=')) {
                                        // Izvelkam faila nosaukumu
                                        const nameMatch = part.match(/name="([^"]+)"/);
                                        const filenameMatch = part.match(/filename="([^"]+)"/);
                                        const typeMatch = part.match(/Content-Type:\s*([^\s\r\n]+)/);
                                        
                                        if (nameMatch && filenameMatch) {
                                            const fieldName = nameMatch[1];
                                            const filename = filenameMatch[1];
                                            const mimeType = typeMatch ? typeMatch[1] : 'image/png';
                                            
                                            // Atrodam kur beidzas galvenes un sākas paša faila dati
                                            const headerEndIndex = part.indexOf('\r\n\r\n');
                                            if (headerEndIndex !== -1) {
                                                const fileContentBinary = part.substring(headerEndIndex + 4, part.length - 2);
                                                const fileBuffer = Buffer.from(fileContentBinary, 'binary');
                                                
                                                // Izveidojam autentisku globālo File objektu
                                                const fileInstance = new File([fileBuffer], filename, { type: mimeType });
                                                formData.set(fieldName, fileInstance);
                                            }
                                        }
                                    }
                                }
                            }
                        }

                        // Pievienojam parastos laukus
                        if (req.body) {
                            Object.keys(req.body).forEach(key => formData.set(key, req.body[key]));
                        }

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
                    cfResponse.headers.forEach((value, key) => res.setHeader(key, value));
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

                if (getHandler) app.get(fullRoute, createCloudflareAdapter(getHandler));
                if (postHandler) app.post(fullRoute, createCloudflareAdapter(postHandler));
                if (genericHandler) app.all(fullRoute, createCloudflareAdapter(genericHandler));
                if (defaultHandler && !getHandler && !postHandler && !genericHandler) {
                    app.all(fullRoute, defaultHandler);
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
