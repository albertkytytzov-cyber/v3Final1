"use client";

import { useEffect, useState } from "react";
import { STORAGE_KEYS } from "../lib/offline-sync";

type OfflineLanguage = "en" | "ru" | "bg";

const COPY: Record<
  OfflineLanguage,
  {
    eyebrow: string;
    title: string;
    intro: string;
    status: string;
    metric: string;
    detail: string;
  }
> = {
  en: {
    eyebrow: "Offline mode",
    title: "Connection is unavailable",
    intro:
      "The app is running in offline mode. If you opened the platform before, cached screens and assets can still load. Reconnect to sync readiness, plans, execution, and analytics data.",
    status: "PWA cache active",
    metric: "offline",
    detail:
      "The static shell is available. Live API requests will resume automatically once the network returns.",
  },
  ru: {
    eyebrow: "Офлайн-режим",
    title: "Подключение недоступно",
    intro:
      "Приложение работает в офлайн-режиме. Если вы уже открывали платформу раньше, сохранённые экраны и ресурсы продолжат загружаться. Подключитесь к сети, чтобы синхронизировать готовность, планы, выполнение и аналитику.",
    status: "Кэш приложения активен",
    metric: "офлайн",
    detail:
      "Статическая оболочка доступна. Запросы к серверу автоматически возобновятся после восстановления сети.",
  },
  bg: {
    eyebrow: "Офлайн режим",
    title: "Няма връзка",
    intro:
      "Приложението работи в офлайн режим. Ако вече сте отваряли платформата, запазените екрани и ресурси ще продължат да се зареждат. Свържете се с мрежата, за да синхронизирате готовността, плановете, изпълнението и анализа.",
    status: "Кешът на приложението е активен",
    metric: "офлайн",
    detail:
      "Статичната обвивка е достъпна. Заявките към сървъра ще се възобновят автоматично, когато мрежата се възстанови.",
  },
};

function isOfflineLanguage(value: string | null): value is OfflineLanguage {
  return value === "en" || value === "ru" || value === "bg";
}

export default function OfflinePage() {
  const [language, setLanguage] = useState<OfflineLanguage>("ru");

  useEffect(() => {
    const savedLanguage = window.localStorage.getItem(STORAGE_KEYS.language);
    if (isOfflineLanguage(savedLanguage)) {
      setLanguage(savedLanguage);
    }
  }, []);

  const copy = COPY[language];

  return (
    <main className="page-shell">
      <section className="hero">
        <div className="panel hero-copy">
          <span className="eyebrow">{copy.eyebrow}</span>
          <h1>{copy.title}</h1>
          <p>{copy.intro}</p>
        </div>

        <aside className="panel status-board">
          <div>
            <span className="status-pill">{copy.status}</span>
            <div className="status-metric">{copy.metric}</div>
            <p>{copy.detail}</p>
          </div>
        </aside>
      </section>
    </main>
  );
}
