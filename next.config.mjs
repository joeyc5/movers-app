/** @type {import('next').NextConfig} */
const nextConfig = {
  // next dev rewrites an agent-rules block into CLAUDE.md/AGENTS.md on every start; this stops it.
  agentRules: false,
  reactCompiler: true,
  compiler: {
    removeConsole: process.env.NODE_ENV === "production",
  },
  async redirects() {
    return [
      {
        source: "/dashboard",
        destination: "/dashboard/default",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
