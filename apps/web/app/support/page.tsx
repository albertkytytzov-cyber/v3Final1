import type { Metadata } from "next";
import Link from "next/link";
import styles from "../legal.module.css";

export const metadata: Metadata = {
  title: "PERFORM | Поддержка",
  description:
    "Поддержка пользователей PERFORM: помощь с аккаунтом, тренировочными планами, готовностью, выполнением и мобильным приложением.",
};

export default function SupportPage() {
  return (
    <main className={styles.legalShell}>
      <Link className={styles.backLink} href="/">
        ← PERFORM
      </Link>

      <header className={styles.hero}>
        <p className={styles.eyebrow}>Поддержка</p>
        <h1 className={styles.title}>Помощь по PERFORM</h1>
        <p className={styles.lead}>
          PERFORM помогает тренерам и спортсменам вести тренировочный процесс:
          готовность, планы, выполнение, данные устройства и аналитика в одной
          рабочей системе.
        </p>
        <p className={styles.meta}>Обновлено: 3 июня 2026</p>
      </header>

      <section className={styles.grid} aria-label="Контакты поддержки">
        <article className={styles.card}>
          <h2>Контакт</h2>
          <ul className={styles.contactList}>
            <li>
              <span className={styles.label}>Email</span>
              <a className={styles.value} href="mailto:xut-xet@mail.ru">
                xut-xet@mail.ru
              </a>
            </li>
            <li>
              <span className={styles.label}>Приложение</span>
              <span className={styles.value}>PERFORM</span>
            </li>
          </ul>
        </article>

        <article className={styles.card}>
          <h2>Что указать в обращении</h2>
          <p>
            Напишите роль пользователя, дату тренировки или готовности, экран,
            где возникла проблема, и приложите снимок экрана, если он есть.
          </p>
        </article>
      </section>

      <section className={styles.section}>
        <h2>С чем помогаем</h2>
        <ul>
          <li>вход в аккаунт тренера или спортсмена;</li>
          <li>назначение и импорт тренировочных планов;</li>
          <li>готовность, дневник тренировки и отметка выполнения;</li>
          <li>синхронизация данных устройства, пульса, сна и тренировок;</li>
          <li>разбор ИИ и аналитика тренировочного процесса.</li>
        </ul>
      </section>

      <section className={styles.section}>
        <h2>Рабочий порядок</h2>
        <p>
          Для тестовых спортсменов и тренеров поддержка отвечает в рабочем
          режиме и помогает отделить ошибку приложения от ошибки данных,
          подключения устройства или настроек аккаунта.
        </p>
      </section>
    </main>
  );
}
