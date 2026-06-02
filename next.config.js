/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ['better-sqlite3'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'www.procyclingstats.com' },
      { protocol: 'https', hostname: 'flagcdn.com' },
    ],
  },
};

module.exports = nextConfig;
