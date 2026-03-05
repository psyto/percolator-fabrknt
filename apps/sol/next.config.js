const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin-allow-popups',
          },
        ],
      },
    ];
  },
  webpack: (config) => {
    // Resolve .js imports to .ts files (percolator-cli uses ESM .js extensions)
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
    };
    // Ensure percolator-cli imports resolve dependencies from our node_modules
    config.resolve.modules = [
      path.resolve(__dirname, 'node_modules'),
      'node_modules',
    ];
    return config;
  },
};

module.exports = nextConfig;
