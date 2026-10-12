import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Files read from disk at runtime that the build cannot trace on its own:
  // the rubric, the PDF renderer's built-in fonts (pdfkit loads them dynamically) and the Poppins print font.
  outputFileTracingIncludes: {
    "/**": ["./prompts/**/*"],
    "/api/briefs/[id]/pdf": ["./node_modules/pdfkit/js/standard-fonts/**/*", "./node_modules/@fontsource/poppins/files/poppins-latin-*-normal.woff"],
    "/api/runs/[id]/deliver": ["./node_modules/pdfkit/js/standard-fonts/**/*", "./node_modules/@fontsource/poppins/files/poppins-latin-*-normal.woff"],
  },
  serverExternalPackages: ["@react-pdf/renderer"],
};

export default nextConfig;
