/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    '@actionos/agent',
    '@actionos/config',
    '@actionos/tools',
    '@actionos/types',
    '@actionos/ui',
    '@actionos/validation',
  ],
  reactStrictMode: true,
};

module.exports = nextConfig;
