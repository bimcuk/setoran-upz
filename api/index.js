const path = require('path');
const fs = require('fs');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://efmgvgqyzdbhmejigqyg.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_qhbns7HHepypJ2s3TiF-MQ_i_-bpaow';
let SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
if (!SUPABASE_SERVICE_ROLE_KEY) {
  try {
    const envPath = path.join(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      const match = envContent.match(/SUPABASE_SERVICE_ROLE_KEY\s*=\s*([^\r\n]+)/);
      if (match) SUPABASE_SERVICE_ROLE_KEY = match[1].trim();
    }
  } catch (_) {}
}

const routes = {
  'backend': require('../lib/api/backend'),
  'bsz-list': require('../lib/api/bsz-list'),
  'delete-penta': require('../lib/api/delete-penta'),
  'delete-setoran': require('../lib/api/delete-setoran'),
  'notifications': require('../lib/api/notifications'),
  'penta-file': require('../lib/api/penta-file'),
  'penta-list': require('../lib/api/penta-list'),
  'rkat-config': require('../lib/api/rkat-config'),
  'save-bsz': require('../lib/api/save-bsz'),
  'save-penta': require('../lib/api/save-penta'),
  'save-rkat-config': require('../lib/api/save-rkat-config'),
  'update-penta-status': require('../lib/api/update-penta-status'),
  'update-profile': require('../lib/api/update-profile'),
  'update-upz': require('../lib/api/update-upz'),
  'upload-penta': require('../lib/api/upload-penta'),
  'upz-list': require('../lib/api/upz-list')
};

async function parseBody(req) {
  if (req.body !== undefined && req.body !== null) return req.body;
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', chunk => raw += chunk);
    req.on('end', () => {
      try { resolve(JSON.parse(raw)); } catch { resolve({}); }
    });
    req.on('error', () => resolve({}));
  });
}

function ensureResHelpers(res) {
  if (!res.status) {
    res.status = function(code) {
      res.statusCode = code;
      return res;
    };
  }
  if (!res.json) {
    res.json = function(data) {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(data));
      return res;
    };
  }
}

module.exports = async function handler(req, res) {
  ensureResHelpers(res);

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, DELETE, PUT');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, apikey');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // Parse endpoint name
  const cleanUrl = (req.url || '').split('?')[0];
  const endpoint = cleanUrl.replace(/^\/api\/?/, '').toLowerCase().trim();

  // Parse body if needed
  if (!req.body && req.method !== 'GET') {
    req.body = await parseBody(req);
  }

  const targetHandler = routes[endpoint];
  if (targetHandler) {
    try {
      return await targetHandler(req, res);
    } catch (err) {
      console.error(`[API ${endpoint} ERROR]`, err);
      return res.status(500).json({ success: false, message: err.message || 'Internal Server Error' });
    }
  }

  // Fallback for transfer-docs-list
  if (endpoint === 'transfer-docs-list' && req.method === 'GET') {
    return res.status(200).json({ success: true, data: {} });
  }

  return res.status(404).json({ success: false, message: `Endpoint ${cleanUrl} tidak ditemukan.` });
};
