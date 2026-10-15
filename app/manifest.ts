import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Cally",
    short_name: "Cally",
    description: "Say what needs fixing. We call nearby shops and show the cheapest first.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#F1F2F5",
    theme_color: "#5B21B6",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
