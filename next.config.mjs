export default {
  poweredByHeader: false,
  turbopack: { root: import.meta.dirname },
  serverExternalPackages: [
    "mongodb",
    "fastify",
    "@fastify/cookie",
    "@fastify/rate-limit",
  ],
};
