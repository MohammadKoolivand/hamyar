export default {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
  turbopack: { root: import.meta.dirname },
  serverExternalPackages: [
    "mongodb",
    "sharp",
    "pdfjs-dist",
    "mathjs",
    "fastify",
    "@fastify/cookie",
    "@fastify/rate-limit",
  ],
};
