const http = require('http');
const httpProxy = require('http-proxy');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from root .env
dotenv.config({ path: path.resolve(__dirname, '.env') });

const PROXY_PORT = parseInt(process.env.PROXY_PORT || '9000', 10);
const AUTH_PORT = process.env.AUTHENTICATION_PORT || 8000;
const USER_PORT = process.env.USER_MANAGEMENT_PORT || 8001;

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || `http://localhost:${AUTH_PORT}`;
const USER_SERVICE_URL = process.env.USER_SERVICE_URL || `http://localhost:${USER_PORT}`;

// Create HTTP Proxy instance
const proxy = httpProxy.createProxyServer({
  ws: true,
  changeOrigin: true,
  xfwd: true,
});

// Proxy error handling
proxy.on('error', (err, req, res) => {
  console.error(`[Proxy Error] ${req.method} ${req.url} -> ${err.message}`);

  if (res && !res.headersSent) {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        success: false,
        statusCode: 502,
        message: 'Bad Gateway: Destination microservice is temporarily unavailable.',
        path: req.url,
        error: err.code || err.message,
      }),
    );
  }
});

// Create HTTP Server
const server = http.createServer((req, res) => {
  const startTime = Date.now();
  const url = req.url || '/';

  // Request/Response logging
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const status = res.statusCode;
    let color = '\x1b[32m'; // green
    if (status >= 500) color = '\x1b[31m'; // red
    else if (status >= 400) color = '\x1b[33m'; // yellow

    console.log(
      `[Proxy Gateway] ${color}${req.method} ${req.url} -> ${status} (${duration}ms)\x1b[0m`,
    );
  });

  // Health check endpoint
  if (url === '/health' || url === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(
      JSON.stringify({
        status: 'UP',
        service: 'hichandra-reverse-proxy',
        port: PROXY_PORT,
        routes: {
          authService: `${AUTH_SERVICE_URL} (/api/auth)`,
          userService: `${USER_SERVICE_URL} (/api/users, /api/bookings, etc.)`,
        },
        timestamp: new Date().toISOString(),
      }),
    );
  }

  // Root endpoint info
  if (url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(
      JSON.stringify({
        name: 'Hi Chandra API Gateway & Reverse Proxy',
        status: 'running',
        port: PROXY_PORT,
        documentation: {
          authService: `${AUTH_SERVICE_URL}/api`,
          userService: `${USER_SERVICE_URL}/api`,
        },
      }),
    );
  }

  // Route /api/auth/* to Auth Service
  if (url.startsWith('/api/auth') || url.startsWith('/auth')) {
    proxy.web(req, res, { target: AUTH_SERVICE_URL });
    return;
  }

  // All other routes (/api/*, static assets, etc.) route to User Service
  proxy.web(req, res, { target: USER_SERVICE_URL });
});

// Handle WebSocket upgrades (Socket.IO / Gateways)
server.on('upgrade', (req, socket, head) => {
  const url = req.url || '';
  console.log(`[Proxy Gateway WS Upgrade] ${url}`);

  if (url.startsWith('/api/auth') || url.startsWith('/auth')) {
    proxy.ws(req, socket, head, { target: AUTH_SERVICE_URL });
  } else {
    proxy.ws(req, socket, head, { target: USER_SERVICE_URL });
  }
});

// Start listening
server.listen(PROXY_PORT, () => {
  console.log('====================================================');
  console.log(`🚀 Reverse Proxy / API Gateway running on port ${PROXY_PORT}`);
  console.log(`👉 Auth Service Target : ${AUTH_SERVICE_URL} (/api/auth/*)`);
  console.log(`👉 User Service Target : ${USER_SERVICE_URL} (All other /api/*)`);
  console.log(`👉 Health Check        : http://localhost:${PROXY_PORT}/health`);
  console.log('====================================================');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nStopping Reverse Proxy...');
  server.close(() => {
    proxy.close();
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  server.close(() => {
    proxy.close();
    process.exit(0);
  });
});
