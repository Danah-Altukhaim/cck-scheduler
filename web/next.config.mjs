/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow reading JSON from parent ../data dir at runtime via fs in Server
  // Components.
  reactStrictMode: true,
  experimental: {
    // Make filesystem access work for files outside the web/ dir.
    outputFileTracingIncludes: {
      '/**/*': ['../data/**/*', '../../CCK Scheduler Docs/**/*'],
    },
  },
}

export default nextConfig
