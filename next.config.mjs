/** @type {import('next').NextConfig} */
import { fileURLToPath } from "node:url";
const nextConfig = { outputFileTracingRoot: fileURLToPath(new URL(".", import.meta.url)) };
export default nextConfig;
