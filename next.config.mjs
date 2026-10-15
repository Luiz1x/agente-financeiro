/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === 'production';
const base = isProd ? '/agente-financeiro' : '';

const nextConfig = {
  output: 'export',
  basePath: base,
  assetPrefix: base || undefined,
  trailingSlash: true,
  images: { unoptimized: true },
  env: { NEXT_PUBLIC_BASE: base },
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
