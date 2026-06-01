const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

const apiDir = path.join(__dirname, 'functions', 'api');

function walkRoutes(dir, routePrefix = '/api') {
    fs.readdirSync(dir).forEach(file => {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            walkRoutes(fullPath, `${routePrefix}/${file}`);
        } else if (file.endsWith('.js')) {
            const routeName = file === 'index.js' ? '' : `/${file.slice(0, -3)}`;
            const fullRoute = `${routePrefix}${routeName}`;
            
            try {
                const handler = require(fullPath);
                app.all(fullRoute, (req, res) => {
                    if (typeof handler === 'function') handler(req, res);
                    else if (handler.default && typeof handler.default === 'function') handler.default(req, res);
                    else res.status(500).send('API handler nav atrasts');
                });
            } catch (e) {
                console.error(`Kļūda ielādējot ${fullRoute}:`, e);
            }
        }
    });
}

if (fs.existsSync(apiDir)) {
    walkRoutes(apiDir);
}

app.use(express.static(path.join(__dirname, 'public')));

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Serveris griežas uz porta ${PORT}`);
});
