/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    turbo: {
      resolveAlias: {}
    }
    // quitamos optimizeCss para evitar critters
  },
  reactStrictMode: true
};

export default nextConfig;
