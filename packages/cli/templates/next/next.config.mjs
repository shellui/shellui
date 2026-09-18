/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  basePath: process.env.NODE_ENV === 'production' ? '/app' : '',
  // Static export has no image optimization server; the default page uses next/image.
  images: { unoptimized: true },
  // Companion must stay on :3000 (see scripts/ensure-port.mjs + package.json "dev").
  //
  // Shellui embeds this app in an iframe from the shell origin (default
  // http://localhost:4000). Next may set restrictive frame headers in some
  // production setups — allow embedding from the local shell. Tighten
  // frame-ancestors for real deployed origins as needed.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors 'self' http://localhost:4000 http://127.0.0.1:4000",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
