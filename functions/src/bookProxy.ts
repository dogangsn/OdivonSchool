import { onRequest } from 'firebase-functions/v2/https';
import { Readable } from 'node:stream';
import type { ReadableStream as WebReadableStream } from 'node:stream/web';

/**
 * Akıllı Kütüphane: streams a MEB ders kitabı PDF to the browser with CORS
 * headers, for when MEB's server does not let pdf.js read it cross-site.
 * Only MEB's own hosts are allowed (meb.ai short links redirect to
 * tymm.meb.gov.tr), so this cannot be used as an open proxy. Range requests
 * pass through, so pdf.js still loads page by page.
 *
 * Client: set environment.libraryProxyUrl to this function's URL.
 */
const ALLOWED_HOSTS = new Set(['tymm.meb.gov.tr', 'meb.ai', 'ogmmateryal.eba.gov.tr']);
const MAX_REDIRECTS = 4;

function allowed(raw: string): URL | null {
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' && ALLOWED_HOSTS.has(url.hostname) ? url : null;
  } catch {
    return null;
  }
}

export const kitapPdf = onRequest({ timeoutSeconds: 120, memory: '256MiB', maxInstances: 10 }, async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Headers', 'Range');
  res.set('Access-Control-Expose-Headers', 'Accept-Ranges, Content-Length, Content-Range');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.status(405).send('Yalnızca GET');
    return;
  }

  let url = allowed(String(req.query.url ?? ''));
  if (!url) {
    res.status(400).send('Yalnızca MEB kitap bağlantıları açılabilir.');
    return;
  }

  const headers: Record<string, string> = { 'User-Agent': 'OdivonSchool-Kutuphane/1.0' };
  if (typeof req.headers.range === 'string') headers['Range'] = req.headers.range;

  let upstream: Response | null = null;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    upstream = await fetch(url, { method: req.method, headers, redirect: 'manual' });
    const location = upstream.headers.get('location');
    if (upstream.status >= 300 && upstream.status < 400 && location) {
      const next = allowed(new URL(location, url).toString());
      if (!next) {
        res.status(502).send('MEB bağlantısı izin verilmeyen bir adrese yönlendirdi.');
        return;
      }
      url = next;
      continue;
    }
    break;
  }
  if (!upstream || upstream.status >= 400 || (upstream.status >= 300 && upstream.status < 400)) {
    res.status(502).send(`MEB sunucusu yanıt vermedi (${upstream?.status ?? 'yok'}).`);
    return;
  }

  const type = upstream.headers.get('content-type') ?? '';
  if (!type.includes('pdf') && !type.includes('octet-stream')) {
    res.status(502).send('Bağlantı bir PDF dosyası döndürmedi.');
    return;
  }

  res.status(upstream.status);
  res.set('Content-Type', 'application/pdf');
  res.set('Cache-Control', 'public, max-age=86400');
  for (const h of ['content-length', 'content-range', 'accept-ranges', 'last-modified', 'etag']) {
    const v = upstream.headers.get(h);
    if (v) res.set(h, v);
  }
  if (req.method === 'HEAD' || !upstream.body) {
    res.end();
    return;
  }
  Readable.fromWeb(upstream.body as unknown as WebReadableStream).pipe(res);
});
