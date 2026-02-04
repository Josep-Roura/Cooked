/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  turbopack: {
    root: new URL(".", import.meta.url).pathname,
    resolveAlias: {
      "@": new URL("./", import.meta.url),
    },
  },
  allowedDevOrigins: ["http://localhost:3000", "http://localhost:3001", "http://192.168.1.148:3000"],
  onDemandEntries: {
    maxInactiveAge: 60 * 60 * 1000,
    pagesBufferLength: 5,
  },
  // Suppress specific CSS parsing warnings
  experimental: {
    // Let Turbopack handle CSS variables more gracefully
    optimizePackageImports: ["@tailwindcss/postcss"],
  },
}

export default nextConfig
