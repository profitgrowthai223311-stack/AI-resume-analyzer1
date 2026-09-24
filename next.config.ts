import type { NextConfig } from "next";

const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  serverExternalPackages: ["unpdf", "mammoth"],
  async headers() {
    return [
      { source: "/(.*)", headers: securityHeaders },
      // Signed PDFs from Supabase Storage are previewed in an iframe on /versions/*.
      { source: "/versions/:path*", headers: [{ key: "Content-Security-Policy", value: `frame-src 'self' ${supabaseHost} https://api.razorpay.com; object-src 'none'; base-uri 'self'` }] },
    ];
  },
};

export default nextConfig;
