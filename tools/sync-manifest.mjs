// manifest.json host izinlerini site listesinden üretir: npm run manifest
import { readFileSync, writeFileSync } from 'node:fs';
import { SITES } from '../extension/src/sites.js';

const path = new URL('../extension/manifest.json', import.meta.url);
const m = JSON.parse(readFileSync(path, 'utf8'));
const hosts = SITES.map((s) => `*://*.${new URL(s.home).hostname.replace(/^(www|autosearch)\./, '')}/*`);
m.host_permissions = [...new Set(hosts), 'https://open.er-api.com/*', 'https://api.frankfurter.dev/*'];
writeFileSync(path, JSON.stringify(m, null, 2) + '\n');
console.log(`${m.host_permissions.length} izin yazıldı.`);
