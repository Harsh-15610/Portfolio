const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function cleanHtml(input) {
  return input
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

async function webSearch(query) {
  const endpoint = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const response = await fetch(endpoint, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; PortfolioBot/1.0; +https://duckduckgo.com/)'
    }
  });

  if (!response.ok) {
    throw new Error(`Search failed with status ${response.status}`);
  }

  const html = await response.text();
  const resultRegex = /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
  const results = [];

  let match;
  while ((match = resultRegex.exec(html)) !== null && results.length < 5) {
    let url = match[1];
    const title = cleanHtml(match[2]);
    const snippet = cleanHtml(match[3]);

    if (url.startsWith('//')) {
      url = `https:${url}`;
    }
    if (url.startsWith('/l/?uddg=')) {
      const params = new URL(`https://duckduckgo.com${url}`).searchParams;
      url = decodeURIComponent(params.get('uddg') || '');
    }

    if (url) {
      results.push({ title, snippet, url });
    }
  }

  return results;
}

function buildAnswer(query, results) {
  if (!results.length) {
    return {
      answer: `I couldn't find reliable live web results for "${query}" right now. Try rephrasing your question with a more specific keyword.`,
      sources: []
    };
  }

  const bullets = results
    .map((r, index) => `${index + 1}. ${r.title}: ${r.snippet}`)
    .join('\n');

  const answer = [
    `Here is a web-assisted response for: "${query}".`,
    '',
    'Top findings:',
    bullets,
    '',
    'I can refine this further if you ask a follow-up (e.g., compare two results, summarize only official docs, or focus on latest updates).'
  ].join('\n');

  return { answer, sources: results };
}

function serveStaticFile(req, res) {
  const requestPath = req.url === '/' ? '/index.html' : req.url;
  const safePath = path.normalize(requestPath).replace(/^\/+/, '');
  const filePath = path.join(PUBLIC_DIR, safePath);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentTypeMap = {
      '.html': 'text/html; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8'
    };

    res.writeHead(200, {
      'Content-Type': contentTypeMap[ext] || 'application/octet-stream'
    });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/api/chat') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1e6) {
        req.socket.destroy();
      }
    });

    req.on('end', async () => {
      try {
        const parsed = JSON.parse(body || '{}');
        const query = String(parsed.message || '').trim();

        if (!query) {
          sendJson(res, 400, { error: 'Message is required.' });
          return;
        }

        const results = await webSearch(query);
        const answer = buildAnswer(query, results);
        sendJson(res, 200, answer);
      } catch (error) {
        sendJson(res, 500, {
          error: 'Unable to complete the web request.',
          details: error.message
        });
      }
    });

    return;
  }

  if (req.method === 'GET') {
    serveStaticFile(req, res);
    return;
  }

  res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Method not allowed');
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
