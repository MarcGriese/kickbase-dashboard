/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Kickbase liefert Spielerbilder ueber diese Hosts aus.
    remotePatterns: [
      { protocol: "https", hostname: "kickbase.b-cdn.net" },
      { protocol: "https", hostname: "cdn.kickbase.com" },
    ],
  },
};
export default nextConfig;
