/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    appDir: true,
  },
  transpilePackages: ['@la-ruche/crypto-core', '@la-ruche/shared'],
  async rewrites() {
    // Proxy Arena API to backend for same-origin in dev/prod (HTTP only; WS should hit backend domain directly)
    const target = process.env.NEXT_PUBLIC_ARENA_API_URL || 'http://127.0.0.1:8083';
    return [
      {
        source: '/api/arena/:path*',
        destination: `${target}/api/arena/:path*`,
      },
      {
        source: '/api/health',
        destination: `${target}/api/health`,
      },
    ];
  },
  webpack: (config) => {
    config.experiments = {
      ...(config.experiments || {}),
      asyncWebAssembly: true,
    };
    return config;
  },
};
export default nextConfig;
