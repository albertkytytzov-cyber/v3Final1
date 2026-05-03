import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PERFORM",
    short_name: "PERFORM",
    description:
      "Платформа для тренеров и спортсменов с готовностью, адаптацией нагрузки, выполнением и аналитикой.",
    start_url: "/",
    display: "standalone",
    background_color: "#0D1117",
    theme_color: "#0D1117",
    lang: "ru",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
