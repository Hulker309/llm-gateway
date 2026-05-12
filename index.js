#!/usr/bin/env node
// =============================================================================
// LLM Gateway - Pure Anthropic passthrough router
// =============================================================================
// CC Switch -> Gateway (:3456/v1/messages) -> DeepSeek / LM Studio (all Anthropic)
// Admin: http://localhost:3456
// =============================================================================

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const CFG = path.join(__dirname, 'gateway-config.json');
const ADMIN_HTML = path.join(__dirname, 'admin.html');
const DEF = {
  gateway: { port: 3456, apiKey: 'gw-' + Math.random().toString(36).substring(2, 18) },
  providers: [
    { id: 'deepseek', name: 'DeepSeek', baseUrl: 'https://api.deepseek.com/anthropic', apiKey: '', enabled: true },
    { id: 'lmstudio', name: 'LM Studio', baseUrl: 'http://127.0.0.1:1234', apiKey: '', enabled: true },
  ],
  routes: [
    { pattern: 'deepseek', target: 'deepseek', label: 'DeepSeek' },
    { pattern: 'qwen', target: 'lmstudio', label: 'Qwen vision' },
    { pattern: 'vision', target: 'lmstudio', label: 'Vision' },
    { pattern: 'local', target: 'lmstudio', label: 'Local' },
  ],
};

let config = DEF;
try { if (fs.existsSync(CFG)) config = { ...DEF, ...JSON.parse(fs.readFileSync(CFG, 'utf8')) }; } catch (e) { console.error('Config error:', e.message); }

let logs = [];
function log(lvl, msg) { const s = '[' + new Date().toISOString() + '] [' + lvl + '] ' + msg; console.log(s); logs.push(s); if (logs.length > 200) logs.shift(); }

function save() { fs.writeFileSync(CFG, JSON.stringify(config, null, 2), 'utf8'); }
function getProv(id) { return config.providers.find(function(p) { return p.id === id; }); }
function matchRoute(model) {
  if (!model) return null;
  // Exact match only. No fallback, no keyword search.
  for (var i = 0; i < config.routes.length; i++) {
    if (config.routes[i].pattern === model) return config.routes[i];
  }
  return null;
}

function forward(url, body, headers, stream) {
  return new Promise(function(resolve, reject) {
    var u = new URL(url);
    var lib = u.protocol === 'https:' ? https : http;
    var bs = JSON.stringify(body);
    var opts = {
      hostname: u.hostname, port: u.port || (lib === https ? 443 : 80),
      path: u.pathname + u.search, method: 'POST', timeout: 120000,
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bs), 'Authorization': headers.authorization || '', 'x-api-key': headers['x-api-key'] || '' },
    };
    var r = lib.request(opts, function(res) {
      if (stream && (res.headers['content-type'] || '').indexOf('event-stream') >= 0) return resolve({ stream: true, response: res });
      var c = [];
      res.on('data', function(d) { c.push(d); });
      res.on('end', function() { resolve({ stream: false, status: res.statusCode, body: Buffer.concat(c).toString('utf8') }); });
    });
    r.on('error', reject);
    r.on('timeout', function() { r.destroy(); reject(new Error('timeout')); });
    r.write(bs);
    r.end();
  });
}

function ok(req) { return ((req.headers['authorization'] || '').replace(/^Bearer\s+/i, '').trim()) === config.gateway.apiKey; }
function json(res, s, d) { res.writeHead(s, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }); res.end(JSON.stringify(d)); }
function err(res, s, m) { json(res, s, { error: { message: m, type: 'error' } }); }
function parseBody(req) {
  return new Promise(function(r) { var c = []; req.on('data', function(d) { c.push(d); }); req.on('end', function() { try { r(JSON.parse(Buffer.concat(c).toString('utf8'))); } catch { r(null); } }); });
}

// -- Serve admin HTML ------------------------------------------------------
function admin(res) {
  fs.readFile(ADMIN_HTML, 'utf8', function(e, html) {
    if (e) { json(res, 500, { error: 'admin.html not found' }); return; }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache, no-store, must-revalidate', 'Pragma': 'no-cache', 'Expires': '0' });
    res.end(html);
  });
}

// -- Server ------------------------------------------------------------------
http.createServer(function(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  var url = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));

  try {
    if (req.method === 'GET' && url.pathname === '/') return admin(res);

    if (req.method === 'GET' && url.pathname === '/api/status') {
      var r = [];
      for (var i = 0; i < config.providers.length; i++) {
        (function(p, idx) {
          if (!p.enabled) { r.push({ id: p.id, name: p.name, checked: false, ok: false }); if (r.length === config.providers.length) json(res, 200, { serverOk: true, providers: r }); return; }
          var u;
          try { u = new URL(p.baseUrl); } catch(e) { r.push({ id: p.id, name: p.name, checked: true, ok: false }); if (r.length === config.providers.length) json(res, 200, { serverOk: true, providers: r }); return; }
          fetch(u.origin, { signal: AbortSignal.timeout(4000) }).then(function(resp) {
            // Any response means TCP connected (server is reachable)
            r.push({ id: p.id, name: p.name, checked: true, ok: true });
            if (r.length === config.providers.length) json(res, 200, { serverOk: true, providers: r });
          }).catch(function() {
            r.push({ id: p.id, name: p.name, checked: true, ok: false });
            if (r.length === config.providers.length) json(res, 200, { serverOk: true, providers: r });
          });
        })(config.providers[i], i);
      }
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/config') {
      (async function() {
        var body = await parseBody(req);
        if (!body) return err(res, 400, 'Invalid JSON');
        config = body; save(); log('info', 'Config saved');
        json(res, 200, { ok: true });
      })();
      return;
    }
    if (req.method === 'GET' && url.pathname === '/api/config') return json(res, 200, config);
    if (req.method === 'GET' && url.pathname === '/api/logs') return json(res, 200, { logs: logs.slice(-100) });
    if (req.method === 'POST' && url.pathname === '/api/logs/clear') { logs = []; return json(res, 200, { ok: true }); }

    // POST /api/test - test a provider
    if (req.method === 'POST' && url.pathname === '/api/test') {
      (async function() {
        var providerId = '', pattern = '';
        try {
          var b = await parseBody(req);
          if (b) { providerId = b.provider; pattern = b.pattern || ''; }
        } catch {}
        if (pattern && pattern.length < 2) {
          return json(res, 200, { ok: false, status: 0, message: 'Model name too short, will never match', provider: providerId });
        }
        if (!providerId) return json(res, 200, { ok: false, message: 'No provider specified' });
        var p = getProv(providerId);
        if (!p || !p.enabled) return json(res, 200, { ok: false, message: 'Provider disabled: ' + providerId });
        // Test through the real routing path: gateway → provider
        var testModel = pattern || 'ping-test';
        // Send to the gateway's own /v1/messages to test real routing
        var testBody = {
          model: testModel,
          messages: [{ role: 'user', content: 'ping' }],
          max_tokens: 5,
          stream: false,
        };
        var target = 'http://127.0.0.1:' + config.gateway.port + '/v1/messages';
        var h = { authorization: 'Bearer ' + config.gateway.apiKey };
        try {
          var result = await forward(target, testBody, h, false);
          var ok = result.status === 200;
          var msg = ok ? 'Route OK' : 'Route FAIL';
          try {
            var j = JSON.parse(result.body);
            if (j.error && j.error.message) msg = j.error.message.slice(0, 150);
            else if (j.content) msg = 'Route OK - provider responded';
          } catch {}
          json(res, 200, { ok: ok, status: result.status, message: msg, provider: providerId, model: testModel });
        } catch (e) {
          json(res, 200, { ok: false, status: 0, message: 'Route unreachable: ' + e.message, provider: providerId });
        }
      })();
      return;
    }

    if (req.method === 'GET' && url.pathname === '/v1/models') {
      var models = [];
      for (var i = 0; i < config.providers.length; i++) {
        var p = config.providers[i];
        if (!p.enabled) continue;
        if (p.id === 'deepseek') { models.push({ id: 'DeepSeek-V4-Pro', owned_by: p.id }); models.push({ id: 'DeepSeek-V4-Flash', owned_by: p.id }); }
        else if (p.id === 'lmstudio') { models.push({ id: 'qwen-vision', owned_by: p.id }); models.push({ id: 'qwen/qwen3.5-9b', owned_by: p.id }); }
        else { models.push({ id: p.id + '-default', owned_by: p.id }); }
      }
      return json(res, 200, { object: 'list', data: models });
    }

    // POST /v1/messages - pure Anthropic passthrough
    if (req.method === 'POST' && url.pathname === '/v1/messages') {
      (async function() {
        if (!ok(req)) return err(res, 401, 'Invalid API key');
        var body = await parseBody(req);
        if (!body || !body.model) return err(res, 400, 'Missing model');
        var route = matchRoute(body.model);
        if (!route) return err(res, 400, 'No route for: ' + body.model);
        var provider = getProv(route.target);
        if (!provider || !provider.enabled) return err(res, 502, 'Provider unavailable');
        var target = provider.baseUrl.replace(/\/+$/, '') + '/v1/messages';
        var h = provider.apiKey ? { authorization: 'Bearer ' + provider.apiKey } : {};
        var stream = body.stream === true;
        log('info', route.target + ' < ' + body.model + (stream ? ' (stream)' : ''));
        try {
          var result = await forward(target, body, h, stream);
          if (result.stream) { res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' }); result.response.pipe(res); }
          else { res.writeHead(result.status, { 'Content-Type': 'application/json' }); res.end(result.body); }
        } catch (e) { log('error', route.target + ': ' + e.message); err(res, 502, route.target + ' error'); }
      })();
      return;
    }

    err(res, 404, 'Not found');
  } catch (e) { err(res, 500, e.message); }
}).listen(config.gateway.port, '127.0.0.1', function() {
  log('info', 'Gateway: http://127.0.0.1:' + config.gateway.port);
  log('info', 'Providers: ' + config.providers.length + ', Routes: ' + config.routes.length);
});
