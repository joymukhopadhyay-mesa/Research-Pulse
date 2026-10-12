import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The rubric is read from disk at runtime, so ship it with every server route.
  outputFileTracingIncludes: {
    "/**": ["./prompts/**/*"],
  },
  serverExternalPackages: ["@react-pdf/renderer"],
};

export default nextConfig;
