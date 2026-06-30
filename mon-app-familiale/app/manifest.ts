import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Easy Life",
    short_name: "Easy Life",
    description: "Organisation familiale: planning, courses, menu et informations utiles.",
    start_url: "/",
    display: "standalone",
    background_color: "#f9f6f5",
    theme_color: "#c74f73",
    orientation: "portrait",
    lang: "fr",
    icons: [
      {
        src: "/icon-512-v3.png?v=4",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/apple-touch-icon-v3.png?v=4",
        sizes: "180x180",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/easy-life-logo-v2.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}