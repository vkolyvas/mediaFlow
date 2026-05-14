/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://127.0.0.1:8040/api/:path*",
      },
    ];
  },
  serverExternalPackages: [],
};

module.exports = nextConfig;