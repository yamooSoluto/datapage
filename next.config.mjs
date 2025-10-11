import { dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: __dirname, // ✅ 루트 혼동 방지
  outputFileTracingIncludes: {
    "*": ["./*"], // ✅ 최신 버전에서 올바른 위치
  },
};

export default nextConfig;
