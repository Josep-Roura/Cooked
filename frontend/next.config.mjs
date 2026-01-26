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
  },
  allowedDevOrigins: ["http://localhost:3000", "http://localhost:3001", "http://192.168.1.148:3000"],
}

export default nextConfig
