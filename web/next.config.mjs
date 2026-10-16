import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // M8: Frontend integration with the API backend.
  // The API URL is configured via NEXT_PUBLIC_API_URL env var.
  // Auth uses HttpOnly cookies with credentials: 'include' on all requests.
  // CORS is handled server-side by the API (see api/src/middleware/cors.ts).
  reactStrictMode: true,
  // eslint-plugin-react-hooks is not installed in this M1 web shell;
  // skip ESLint during build (run `npm run lint` separately for checks).
  eslint: {
    ignoreDuringBuilds: true,
  },
  // TypeScript 7.x removed baseUrl; explicitly provide the alias so webpack
  // resolves @/* paths without needing baseUrl in tsconfig.json.
  webpack: (config) => {
    config.resolve.alias['@'] = resolve(__dirname, 'src');
    return config;
  },
};

export default nextConfig;
