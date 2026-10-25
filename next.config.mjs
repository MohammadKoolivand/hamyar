export default {
  poweredByHeader: false,
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
