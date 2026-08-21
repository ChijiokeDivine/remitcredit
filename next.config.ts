import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Configures Next.js to use your isolated TS configuration file
  typescript: {
    tsconfigPath: 'tsconfig.frontend.json',
    ignoreBuildErrors: true, // Replaces the need for ignoring linting blocks during early builds
  },
  images: {
    remotePatterns: [
      // Uses the native URL pattern syntax supported in Next.js 15.3+ and 16+
      new URL('https://media.lordicon.com/**'),
    ],
  },
};

export default nextConfig;
