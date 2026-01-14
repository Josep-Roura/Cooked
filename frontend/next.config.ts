import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  turbopack: {
    // fuerza a que el root sea /frontend y no el repo entero
    root: __dirname,
  },
  allowedDevOrigins: ["http://localhost:3000", "http://192.168.1.148:3000"],
}

export default nextConfig
