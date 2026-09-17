const http = require('http');
const httpProxy = require('http-proxy');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '.env') });

const AUTH_PORT = process.env.AUTHENTICATION_PORT || 8000;
const USER_PORT = process.env.USER_MANAGEMENT_PORT || 8001;
const PORT = process.env.PROXY_PORT || 9000;

// Create a proxy server
const proxy = httpProxy.createProxyServer({});

// Listen for proxy errors
proxy.on('error', function (err, req, res) {
  console.error('Proxy error:', err.message);
  if (!res.headersSent) {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
  }
  res.end('Something went wrong with the proxy.');
});

// Create the gateway server
const server = http.createServer((req, res) => {
  if (req.url.startsWith('/api/auth')) {
    // Route to Auth Service
    proxy.web(req, res, { target: `http://127.0.0.1:${AUTH_PORT}` });
  } else if (
    req.url.startsWith('/api/users') ||
    req.url.startsWith('/api/user') ||
    req.url.startsWith('/api/bookings') ||
    req.url.startsWith('/api/booking') ||
    req.url.startsWith('/api/contact-us') ||
    req.url.startsWith('/api')
  ) {
    // Route to User Service
    proxy.web(req, res, { target: `http://127.0.0.1:${USER_PORT}` });
  } else {
    // Default fallback to User Service
    proxy.web(req, res, { target: `http://127.0.0.1:${USER_PORT}` });
  }
});

// Support WebSocket connections (Socket.IO / Gateways)
server.on('upgrade', function (req, socket, head) {
  proxy.ws(req, socket, head, { target: `http://127.0.0.1:${USER_PORT}` });
});

server.listen(PORT, () => {
  console.log(`🚀 Local API Gateway running on http://127.0.0.1:${PORT}`);
  console.log(`Routing /api/auth -> http://127.0.0.1:${AUTH_PORT}`);
  console.log(`Routing /api/*    -> http://127.0.0.1:${USER_PORT}`);
});
