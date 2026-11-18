const nextConfig = {
  output: 'standalone',
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: 'https', hostname: 'avatars.githubusercontent.com', pathname: '/**' },
    ],
  },
  experimental: {
    // Remove if not using Server Components
    serverComponentsExternalPackages: ['mongodb'],
    serverActions: {
      // Permitir orígenes del proxy de Kubernetes (ingress reescribe el host)
      allowedOrigins: [
        'schedule-sync-141.preview.emergentagent.com',
        'schedule-sync-141.cluster-5.preview.emergentcf.cloud',
        '*.preview.emergentagent.com',
        '*.preview.emergentcf.cloud',
        'localhost:3000',
      ],
    },
  },
  webpack(config, { dev }) {
    if (dev) {
      // Reduce CPU/memory from file watching
      config.watchOptions = {
        poll: 2000, // check every 2 seconds
        aggregateTimeout: 300, // wait before rebuilding
        ignored: ['**/node_modules'],
      };
    }
    return config;
  },
  onDemandEntries: {
    maxInactiveAge: 10000,
    pagesBufferLength: 2,
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "ALLOWALL" },
          { key: "Content-Security-Policy", value: "frame-ancestors *;" },
          { key: "Access-Control-Allow-Origin", value: process.env.CORS_ORIGINS || "*" },
          { key: "Access-Control-Allow-Methods", value: "GET, POST, PUT, DELETE, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "*" },
        ],
      },
      // Zonas privadas: nunca indexar (refuerzo de robots.txt y de las metaetiquetas)
      ...['/dashboard', '/dashboard/:path*', '/api/:path*', '/manage/:path*'].map((source) => ({
        source,
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      })),
      // Recursos estáticos de marketing con caché larga
      ...['/screenshots/:path*', '/brand/:path*', '/og/:path*'].map((source) => ({
        source,
        headers: [{ key: "Cache-Control", value: "public, max-age=2592000, stale-while-revalidate=86400" }],
      })),
    ];
  },
};

module.exports = nextConfig;
