import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // This web app has its own lockfile; scope file tracing to it.
  outputFileTracingRoot: __dirname,
};

export default nextConfig;
