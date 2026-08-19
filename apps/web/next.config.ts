import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The shared package ships CommonJS from packages/shared/dist.
  transpilePackages: ['@simulyn/shared'],
  eslint: { ignoreDuringBuilds: true },
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
};

export default nextConfig;
