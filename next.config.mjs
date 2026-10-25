export default {
  poweredByHeader: false,
  turbopack: { root: import.meta.dirname },
  serverExternalPackages: [
    "mongodb",
    "mathjs",
    "fastify",
    "@fastify/cookie",
    "@fastify/rate-limit",
    "pdfjs-dist",
  ],
};
