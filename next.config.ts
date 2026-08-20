import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Configures Next.js to use your isolated TS configuration file
  typescript: {
    tsconfigPath: 'tsconfig.frontend.json',
    ignoreBuildErrors: true, // Replaces the need for ignoring linting blocks during early builds
  },
};

export default nextConfig;
