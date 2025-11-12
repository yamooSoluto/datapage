/** @type {import('next').NextConfig} */
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development', // 개발 중에는 비활성화
  buildExcludes: [
    /middleware-manifest\.json$/,
    /dynamic-css-manifest\.json$/,
  ],
});

const nextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        fs: false,
        net: false,
        tls: false,
        child_process: false,
      };
    }
    return config;
  },
}

module.exports = withPWA(nextConfig);