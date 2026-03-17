const { PHASE_DEVELOPMENT_SERVER } = require('next/constants');

const devApiProxyTarget = process.env.API_PROXY_TARGET || 'http://127.0.0.1:8080';

module.exports = (phase) => {
  /** @type {import('next').NextConfig} */
  const nextConfig = {
    distDir: 'build',
    trailingSlash: true,
    skipTrailingSlashRedirect: true,
  };

  if (phase === PHASE_DEVELOPMENT_SERVER) {
    nextConfig.rewrites = async () => ([
      {
        source: '/api/:path*',
        destination: `${devApiProxyTarget}/api/:path*`,
      },
    ]);
  } else {
    nextConfig.output = 'export';
  }

  return nextConfig;
};
