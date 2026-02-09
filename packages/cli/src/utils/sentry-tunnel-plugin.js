/**
 * Vite plugin to handle Sentry tunnel endpoint for localhost CORS bypass.
 * This middleware proxies Sentry requests through the dev server to avoid CORS issues.
 * 
 * Sentry tunnel works by:
 * 1. Client sends envelope to /api/sentry-tunnel
 * 2. Server extracts DSN from envelope header
 * 3. Server forwards envelope to Sentry's ingest endpoint
 * 4. Response is forwarded back to client
 */
export function sentryTunnelPlugin() {
  return {
    name: 'sentry-tunnel',
    configureServer(server) {
      server.middlewares.use('/api/sentry-tunnel', async (req, res, next) => {
        // Only handle POST requests (Sentry sends events via POST)
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.setHeader('Allow', 'POST');
          res.end('Method Not Allowed');
          return;
        }

        try {
          // Read the request body
          const chunks = [];
          req.on('data', (chunk) => {
            chunks.push(chunk);
          });

          req.on('end', async () => {
            try {
              const body = Buffer.concat(chunks);
              const bodyString = body.toString('utf-8');
              
              // Sentry envelope format: header (JSON) + newline + payload
              // Header contains the DSN
              const lines = bodyString.split('\n');
              if (lines.length === 0) {
                res.statusCode = 400;
                res.end('Invalid Sentry envelope: empty body');
                return;
              }

              // Parse the envelope header (first line)
              let dsn;
              try {
                const header = JSON.parse(lines[0]);
                dsn = header.dsn;
              } catch (parseError) {
                // Try to extract DSN from the header string directly
                const dsnMatch = bodyString.match(/"dsn"\s*:\s*"([^"]+)"/);
                if (dsnMatch) {
                  dsn = dsnMatch[1];
                } else {
                  res.statusCode = 400;
                  res.end('Invalid Sentry envelope: DSN not found in header');
                  return;
                }
              }

              if (!dsn) {
                res.statusCode = 400;
                res.end('Invalid Sentry envelope: DSN is empty');
                return;
              }

              await proxyToSentry(dsn, body, res);
            } catch (error) {
              console.error('Error processing Sentry tunnel:', error);
              res.statusCode = 500;
              res.end('Internal Server Error');
            }
          });

          req.on('error', (error) => {
            console.error('Request error in Sentry tunnel:', error);
            res.statusCode = 500;
            res.end('Internal Server Error');
          });
        } catch (error) {
          console.error('Error in Sentry tunnel middleware:', error);
          res.statusCode = 500;
          res.end('Internal Server Error');
        }
      });
    },
  };
}

/**
 * Proxy the request to Sentry's ingest endpoint
 */
async function proxyToSentry(dsn, body, res) {
  try {
    // Parse DSN to get the Sentry endpoint
    // DSN format: https://<key>@<host>/<project-id>
    // Example: https://abc123@o123456.ingest.sentry.io/789012
    const dsnMatch = dsn.match(/^https?:\/\/([^@]+)@([^\/]+)\/(.+)$/);
    if (!dsnMatch) {
      res.statusCode = 400;
      res.end('Invalid DSN format');
      return;
    }

    const [, , host, projectId] = dsnMatch;
    
    // Sentry ingest endpoint for envelopes
    const sentryUrl = `https://${host}/api/${projectId}/envelope/`;

    // Forward the request to Sentry
    const fetchResponse = await fetch(sentryUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-sentry-envelope',
        'User-Agent': 'sentry-tunnel/1.0',
      },
      body: body,
    });

    // Forward the response status and headers
    res.statusCode = fetchResponse.status;
    fetchResponse.headers.forEach((value, key) => {
      // Don't forward certain headers that shouldn't be proxied
      const lowerKey = key.toLowerCase();
      if (!['content-encoding', 'transfer-encoding', 'connection', 'keep-alive'].includes(lowerKey)) {
        res.setHeader(key, value);
      }
    });

    // Forward the response body
    const responseBody = await fetchResponse.arrayBuffer();
    res.end(Buffer.from(responseBody));
  } catch (error) {
    console.error('Error proxying to Sentry:', error);
    res.statusCode = 502;
    res.end('Bad Gateway: Failed to proxy to Sentry');
  }
}
