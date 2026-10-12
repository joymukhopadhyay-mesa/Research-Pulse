import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Files read from disk at runtime that the build cannot trace on its own:
  // the rubric, and the PDF renderer's built-in fonts (pdfkit loads them dynamically).
  outputFileTracingIncludes: {
    "/**": ["./prompts/**/*"],
    "/api/briefs/[id]/pdf": ["./node_modules/pdfkit/js/standard-fonts/**/*"],
    "/api/runs/[id]/deliver": ["./node_modules/pdfkit/js/standard-fonts/**/*"],
  },
  serverExternalPackages: ["@react-pdf/renderer"],
};

export default nextConfig;
