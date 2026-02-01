export default function manifest() {
  return {
    name: "LIFAI",
    short_name: "LIFAI",
    description: "AI × LIFE × 副業 コミュニティ",
    start_url: "/",
    display: "standalone",
    background_color: "#0B1022",
    theme_color: "#0B1022",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
