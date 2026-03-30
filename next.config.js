import nextPWA from "next-pwa";

const withPWA = nextPWA({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  experimental: {
    // ffmpeg-static / @ffprobe-installer を webpack バンドル対象外にする
    // これにより __dirname が書き換えられずバイナリパスが正しく解決される
    serverComponentsExternalPackages: [
      "ffmpeg-static",
      "@ffprobe-installer/ffprobe",
      "fluent-ffmpeg",
    ],

    // Vercel デプロイ時に ffmpeg バイナリをサーバーレス関数に含める
    outputFileTracingIncludes: {
      "/api/song/approve-structure": [
        "./node_modules/ffmpeg-static/**",
        "./node_modules/@ffprobe-installer/**",
      ],
    },
  },
};

export default withPWA(nextConfig);
