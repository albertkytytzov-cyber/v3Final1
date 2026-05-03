type SearchParamValue = string | string[] | undefined;

export const LANDING_COPY = {
  en: {
    code: "EN",
    languageLabel: "Language",
    brandTagline: "Data. Analytics. Results.",
    nav: [
      { href: "#coach", label: "For coaches" },
      { href: "#athlete", label: "For athletes" },
      { href: "#club", label: "For clubs" },
      { href: "#features", label: "Features" },
      { href: "#readiness", label: "Readiness" },
    ],
    header: {
      ariaLabel: "Main navigation",
      login: "Log in",
      register: "Start now",
    },
    hero: {
      eyebrow: "Training process operating system",
      title: "Manage training decisions with clear data",
      subtitle:
        "PERFORM helps coaches see athlete readiness, control load, track sleep, heart rate, weight, well-being, and adapt the training day before work starts.",
      primary: "Start now",
      secondary: "View features",
      note: "For coaches, athletes, teams, and sports clubs.",
      chips: [
        "Readiness in under 30 seconds",
        "Plan and actual work on one screen",
        "Load adapted by daily status",
        "Self-hosted setup for teams and clubs",
      ],
    },
    dashboard: {
      statusLabel: "Today status",
      systemLabel: "Training OS",
      readinessLabel: "Readiness today",
      readinessStatus: "Optimal",
      metrics: [
        { label: "Sleep", value: "8h 20m" },
        { label: "Heart rate", value: "43" },
        { label: "Weight", value: "57.5 kg" },
        { label: "Well-being", value: "5/5" },
      ],
      recommendationLabel: "Recommendation",
      recommendation:
        "Main session is available; control volume after the intensive block.",
      athleteWorkspace: "Athlete workspace",
      dailyReadiness: "Daily readiness",
      taper: "Taper",
      yellowDay: "Yellow day",
      assignedDay: "Assigned training day",
      dayValue: "Day 3",
      executionTracking: "Execution tracking",
      executionValue: "2 / 3 blocks",
      offlineSync: "Offline sync",
      synced: "Synced",
      planningStudio: "Planning studio",
      microcycle: "Pre-competition microcycle",
    },
    features: {
      unifiedHead: {
        eyebrow: "Instead of scattered data",
        title: "One system instead of tables, messages, and notes",
        intro:
          "PERFORM brings daily signals, plans, execution, and preparation context into one product instead of separate spreadsheets and chats.",
      },
      unifiedCards: [
        {
          eyebrow: "Athlete data",
          title: "Sleep, weight, pulse, and subjective signals in one flow",
          description:
            "Sleep, weight, heart rate, well-being, soreness, motivation, and pain are collected in one working screen.",
          visual: "signals",
        },
        {
          eyebrow: "Daily plan",
          title: "The training day works like a real task",
          description:
            "The coach assigns days, sessions, blocks, and exercises. The athlete sees only the current task.",
          visual: "calendar",
        },
        {
          eyebrow: "Readiness",
          title: "Daily status is calculated before the load starts",
          description:
            "The system calculates readiness and shows a green, yellow, or red status.",
          visual: "dots",
        },
        {
          eyebrow: "Adaptation",
          title: "Load is adjusted by rules, not guesswork",
          description:
            "When readiness drops, the system suggests which block to reduce, remove, or replace.",
          visual: "bars",
        },
      ],
      capabilityHead: {
        eyebrow: "Key features",
        title: "The full decision cycle before, during, and after training",
        intro:
          "Planning, readiness, adaptation, analytics, and execution are tied to the real training workflow.",
      },
      featureCards: [
        {
          eyebrow: "Planning",
          title: "Preparation planning",
          description:
            "Create training plans, microcycles, blocks, exercises, and assign them to specific athletes.",
          visual: "bars",
        },
        {
          eyebrow: "Readiness",
          title: "Readiness control",
          description:
            "The athlete submits daily data, while the coach sees current status before loading begins.",
          visual: "dots",
        },
        {
          eyebrow: "Adaptation",
          title: "Load adaptation",
          description:
            "PERFORM helps decide whether to complete the plan, reduce volume, or replace intensity with recovery.",
          visual: "calendar",
        },
        {
          eyebrow: "Analytics",
          title: "Trend analytics",
          description:
            "Weight, sleep, pulse, subjective state, plan execution, and load are shown in clear dynamics.",
          visual: "signals",
        },
      ],
    },
    roles: {
      eyebrow: "Who it is for",
      title: "PERFORM works as one operating layer for the team",
      intro:
        "The platform keeps planning, readiness, and execution control in one flow for the coach, athlete, and club.",
      cards: [
        {
          id: "coach",
          eyebrow: "For coaches",
          title: "Team control and decisions before load starts",
          description:
            "Monitor all athletes, assign plans, review readiness, adapt load, and prepare for competitions.",
          points: [
            "Athlete list with color statuses",
            "Plan assignment and execution control",
            "Execution review and analytics without extra screens",
          ],
        },
        {
          id: "athlete",
          eyebrow: "For athletes",
          title: "One clear screen for every training day",
          description:
            "Daily plan, data entry, execution marks, recommendations, and mobile work in one place.",
          points: [
            "Readiness in 20-30 seconds",
            "Adapted day without confusion",
            "Execution and sync status in the working flow",
          ],
        },
        {
          id: "club",
          eyebrow: "For clubs",
          title: "One system for coaches, groups, and long cycles",
          description:
            "A shared system for coaches, groups, athletes, competitions, and long-term development.",
          points: [
            "One data flow instead of chats and spreadsheets",
            "Competitions, seasons, and cycles in one model",
            "Self-hosted deployment on your own server",
          ],
        },
      ],
    },
    readiness: {
      eyebrow: "Readiness status",
      title: "Green, yellow, red: a simple decision before training",
      intro:
        "The coach does not guess by feel. The system shows status reasons and suggests an adjustment before the main work starts.",
      statuses: [
        {
          tone: "green",
          label: "GREEN / Ready",
          title: "The plan is completed as designed",
          points: [
            "The main task of the day stays in place",
            "Quality and volume can follow the plan",
            "The coach sees a clear green signal",
          ],
        },
        {
          tone: "yellow",
          label: "YELLOW / Caution",
          title: "Reduce volume and preserve quality",
          points: [
            "Remove secondary blocks",
            "Keep the technically important part of the day",
            "Control volume after intensive work",
          ],
        },
        {
          tone: "red",
          label: "RED / Risk",
          title: "Lower the load and replace it with recovery",
          points: [
            "Remove intensity and tiring blocks",
            "Move the day toward recovery or mobility",
            "Avoid blind decisions under stress",
          ],
        },
      ],
    },
    competition: {
      eyebrow: "Competitions and cycles",
      title: "Preparation planning for competitions",
      intro:
        "PERFORM connects competitions, preparation phases, days to start, microcycles, mesocycles, and long-term goals in one planning context.",
      cards: [
        {
          eyebrow: "Competitions",
          title: "Start calendar",
          description:
            "The system stores key starts and connects them with the preparation phase, readiness, and template assignment.",
          tag: "Competition planning",
        },
        {
          eyebrow: "Start taper",
          title: "Taper and phase context",
          description:
            "PERFORM accounts for days to start, taper state, and competition priority when adapting the training day.",
          tag: "Taper aware",
        },
        {
          eyebrow: "Weight control",
          title: "Weight and pre-competition control",
          description:
            "Weight, morning signals, and target ranges stay connected across readiness, analytics, and competition review.",
          tag: "Weight control",
        },
        {
          eyebrow: "Peak shape",
          title: "Peak planning",
          description:
            "The link from week to mesocycle to season helps protect tapering from accidental overload.",
          tag: "Peak shape",
        },
        {
          eyebrow: "Olympic cycle",
          title: "Long-term trajectory",
          description:
            "Seasons, cycles, and competition plans become part of one model instead of separate documents.",
          tag: "Olympic cycle",
        },
      ],
    },
    product: {
      eyebrow: "Product preview",
      title: "The whole workspace on one screen",
      intro:
        "The preview uses real parts of the current system: athlete workspace, coach workspace, daily readiness, execution tracking, competition context, and offline sync.",
      panelEyebrow: "PERFORM workspace",
      panelTitle: "One workspace for coach decisions and athlete execution",
      panelMeta: "Athlete • Coach • Planning • Offline",
      cards: [
        {
          eyebrow: "Readiness",
          title: "Daily readiness",
          value: "72%",
          points: ["Sleep, pulse, weight, well-being", "Daily status and decision reasons"],
        },
        {
          eyebrow: "Training day",
          title: "Assigned training day",
          value: "Day 3",
          points: ["Sessions, blocks, and exercises", "Only the current task for the athlete"],
        },
        {
          eyebrow: "Execution",
          title: "Execution tracking",
          value: "2 / 3",
          points: ["Plan versus actual work", "Load, RPE, duration, and comments"],
        },
        {
          eyebrow: "Competition phase",
          title: "Competition context",
          value: "Taper",
          points: ["Phase, days to start, priority", "Context for readiness and adaptation"],
        },
        {
          eyebrow: "Sync state",
          title: "Offline sync",
          value: "Synced",
          points: ["Pending / synced / failed", "Reliable queue in poor network conditions"],
        },
      ],
      footerNotes: [
        "Athlete workspace",
        "Coach workspace",
        "Daily readiness",
        "Execution tracking",
        "Competition context",
        "Offline sync",
      ],
    },
    finalCta: {
      eyebrow: "PERFORM",
      title: "PERFORM is a system for data-driven coaching decisions",
      text:
        "Launch the platform, add athletes, assign a plan, and control readiness every day. Workspace, readiness, execution, and analytics are already available.",
      primary: "Start now",
      secondary: "Log in",
    },
    footer: {
      login: "Login",
      copyright: "© 2026 PERFORM. Training Process Platform.",
      tagline: "Training process operating system",
    },
  },
  ru: {
    code: "RU",
    languageLabel: "Язык",
    brandTagline: "Данные. Аналитика. Результат.",
    nav: [
      { href: "#coach", label: "Для тренера" },
      { href: "#athlete", label: "Для спортсмена" },
      { href: "#club", label: "Для клуба" },
      { href: "#features", label: "Возможности" },
      { href: "#readiness", label: "Готовность" },
    ],
    header: {
      ariaLabel: "Основная навигация",
      login: "Войти",
      register: "Начать",
    },
    hero: {
      eyebrow: "Система управления тренировочным процессом",
      title: "Управляйте тренировочным процессом на основе данных",
      subtitle:
        "PERFORM помогает тренеру видеть готовность спортсмена, контролировать нагрузку, отслеживать сон, пульс, вес и самочувствие, а также адаптировать тренировочный день до начала работы.",
      primary: "Начать работу",
      secondary: "Посмотреть возможности",
      note: "Для тренеров, спортсменов, команд и спортивных клубов.",
      chips: [
        "Готовность за 30 секунд",
        "План и факт на одном экране",
        "Адаптация нагрузки по статусу дня",
        "Свой сервер для команды или клуба",
      ],
    },
    dashboard: {
      statusLabel: "Статус на сегодня",
      systemLabel: "Тренировочная система",
      readinessLabel: "Готовность сегодня",
      readinessStatus: "Оптимальная",
      metrics: [
        { label: "Сон", value: "8 ч 20 мин" },
        { label: "Пульс", value: "43" },
        { label: "Вес", value: "57.5 кг" },
        { label: "Самочувствие", value: "5/5" },
      ],
      recommendationLabel: "Рекомендация",
      recommendation:
        "Основная тренировка доступна; контролируйте объём после интенсивного блока.",
      athleteWorkspace: "Зона спортсмена",
      dailyReadiness: "Ежедневная готовность",
      taper: "Подводка",
      yellowDay: "Жёлтый день",
      assignedDay: "Назначенный тренировочный день",
      dayValue: "День 3",
      executionTracking: "Контроль выполнения",
      executionValue: "2 / 3 блока",
      offlineSync: "Офлайн-синхронизация",
      synced: "Синхронизировано",
      planningStudio: "Планирование",
      microcycle: "Микроцикл перед стартом",
    },
    features: {
      unifiedHead: {
        eyebrow: "Вместо разрозненных данных",
        title: "Одна система вместо таблиц, сообщений и заметок",
        intro:
          "PERFORM собирает ежедневные сигналы, план, фактическое выполнение и контекст подготовки в одном продукте, а не в отдельных таблицах и чатах.",
      },
      unifiedCards: [
        {
          eyebrow: "Данные спортсмена",
          title: "Сон, вес, пульс и субъективные сигналы в одном контуре",
          description:
            "Сон, вес, пульс, самочувствие, крепатура, мотивация и боль собираются в одном рабочем экране.",
          visual: "signals",
        },
        {
          eyebrow: "План на день",
          title: "Тренировочный день оформлен как рабочая задача",
          description:
            "Тренер назначает тренировочные дни, сессии, блоки и упражнения. Спортсмен видит только актуальную задачу.",
          visual: "calendar",
        },
        {
          eyebrow: "Готовность",
          title: "Статус дня рассчитывается до начала нагрузки",
          description:
            "Система рассчитывает готовность дня и показывает статус: зелёный, жёлтый или красный.",
          visual: "dots",
        },
        {
          eyebrow: "Адаптация",
          title: "Нагрузка корректируется по правилам, а не на глаз",
          description:
            "При сниженной готовности система подсказывает, какой блок сократить, убрать или заменить.",
          visual: "bars",
        },
      ],
      capabilityHead: {
        eyebrow: "Ключевые возможности",
        title: "Весь цикл решений до, во время и после тренировки",
        intro:
          "Планирование, готовность, адаптация, аналитика и контроль выполнения связаны с реальным тренировочным процессом.",
      },
      featureCards: [
        {
          eyebrow: "Планирование",
          title: "Планирование подготовки",
          description:
            "Создавайте тренировочные планы, микроциклы, блоки, упражнения и назначайте их конкретным спортсменам.",
          visual: "bars",
        },
        {
          eyebrow: "Готовность",
          title: "Контроль готовности",
          description:
            "Спортсмен ежедневно вносит данные, а тренер видит текущее состояние до начала нагрузки.",
          visual: "dots",
        },
        {
          eyebrow: "Адаптация",
          title: "Адаптация нагрузки",
          description:
            "PERFORM помогает решить, выполнять план полностью, сократить объём или заменить интенсивность восстановлением.",
          visual: "calendar",
        },
        {
          eyebrow: "Аналитика",
          title: "Аналитика динамики",
          description:
            "Вес, сон, пульс, субъективное состояние, выполнение плана и нагрузка отображаются в понятной динамике.",
          visual: "signals",
        },
      ],
    },
    roles: {
      eyebrow: "Для кого",
      title: "PERFORM работает как единая рабочая система команды",
      intro:
        "Платформа объединяет планирование, готовность и контроль выполнения в одном процессе для тренера, спортсмена и клуба.",
      cards: [
        {
          id: "coach",
          eyebrow: "Для тренера",
          title: "Контроль команды и решений до начала нагрузки",
          description:
            "Контроль всех спортсменов, назначение планов, мониторинг готовности, корректировка нагрузки и подготовка к соревнованиям.",
          points: [
            "Список спортсменов с цветовыми статусами",
            "Назначение планов и контроль выполнения",
            "Разбор выполнения и аналитика без лишних переходов",
          ],
        },
        {
          id: "athlete",
          eyebrow: "Для спортсмена",
          title: "Один понятный экран на каждый тренировочный день",
          description:
            "План на день, ввод данных, отметка выполнения, рекомендации и работа с телефона.",
          points: [
            "Готовность за 20-30 секунд",
            "Адаптированный день без путаницы",
            "Выполнение и синхронизация прямо в рабочем процессе",
          ],
        },
        {
          id: "club",
          eyebrow: "Для клуба",
          title: "Общая система для тренеров, групп и долгосрочного цикла",
          description:
            "Единая система для тренеров, групп, спортсменов, соревнований и долгосрочного развития.",
          points: [
            "Один контур данных вместо чатов и таблиц",
            "Соревнования, сезоны и циклы в общей модели",
            "Развёртывание на собственном сервере",
          ],
        },
      ],
    },
    readiness: {
      eyebrow: "Статус готовности",
      title: "Зелёный, жёлтый, красный: простое решение перед тренировкой",
      intro:
        "Тренер не гадает по ощущениям. Система показывает причины статуса и предлагает корректировку до начала основной работы.",
      statuses: [
        {
          tone: "green",
          label: "ЗЕЛЁНЫЙ / Готов",
          title: "План выполняется полностью",
          points: [
            "Основная задача дня сохраняется",
            "Качество и объём можно вести по плану",
            "Тренер видит понятный зелёный сигнал",
          ],
        },
        {
          tone: "yellow",
          label: "ЖЁЛТЫЙ / Осторожно",
          title: "Сократить объём и сохранить качество",
          points: [
            "Убрать второстепенные блоки",
            "Оставить технически важную часть дня",
            "Контролировать объём после интенсивной нагрузки",
          ],
        },
        {
          tone: "red",
          label: "КРАСНЫЙ / Риск",
          title: "Снизить нагрузку и заменить восстановлением",
          points: [
            "Убрать интенсивность и утомляющие блоки",
            "Сместить день в восстановление или мобильность",
            "Не принимать решения вслепую под стрессом",
          ],
        },
      ],
    },
    competition: {
      eyebrow: "Соревнования и циклы",
      title: "Планирование подготовки к соревнованиям",
      intro:
        "PERFORM учитывает соревнования, этап подготовки, дни до старта, микроциклы, мезоциклы и долгосрочные цели в одном планировочном контексте.",
      cards: [
        {
          eyebrow: "Соревнования",
          title: "Календарь стартов",
          description:
            "Система хранит ключевые старты и связывает их с этапом подготовки, готовностью и назначением шаблонов.",
          tag: "Планирование стартов",
        },
        {
          eyebrow: "Подводка к старту",
          title: "Подводка и фазовый контекст",
          description:
            "PERFORM учитывает дни до старта, состояние подводки и приоритет соревнования при адаптации тренировочного дня.",
          tag: "Учитывает подводку",
        },
        {
          eyebrow: "Контроль веса",
          title: "Вес и предсоревновательный контроль",
          description:
            "Вес, утренние сигналы и целевые рамки не теряются между готовностью, аналитикой и разбором соревнований.",
          tag: "Контроль веса",
        },
        {
          eyebrow: "Пиковая форма",
          title: "Планирование пика",
          description:
            "Связь недели, мезоцикла и сезона помогает не разрушить подводку случайной перегрузкой.",
          tag: "Пик формы",
        },
        {
          eyebrow: "Олимпийский цикл",
          title: "Долгосрочная траектория",
          description:
            "Сезоны, циклы и планы стартов становятся частью одной модели, а не разрозненных документов.",
          tag: "Олимпийский цикл",
        },
      ],
    },
    product: {
      eyebrow: "Рабочее пространство",
      title: "Вся рабочая зона на одном экране",
      intro:
        "В демонстрации используются реальные элементы текущей системы: зона спортсмена, зона тренера, ежедневная готовность, контроль выполнения, соревновательный контекст и офлайн-синхронизация.",
      panelEyebrow: "Рабочая зона PERFORM",
      panelTitle: "Одна рабочая зона для решений тренера и выполнения спортсмена",
      panelMeta: "Спортсмен • Тренер • Планирование • Офлайн",
      cards: [
        {
          eyebrow: "Готовность",
          title: "Ежедневная готовность",
          value: "72%",
          points: ["Сон, пульс, вес, самочувствие", "Статус дня и причины решения"],
        },
        {
          eyebrow: "Тренировочный день",
          title: "Назначенный день",
          value: "День 3",
          points: ["Сессии, блоки и упражнения", "Только актуальная задача для спортсмена"],
        },
        {
          eyebrow: "Выполнение",
          title: "Контроль выполнения",
          value: "2 / 3",
          points: ["План и факт", "Нагрузка, RPE, длительность и комментарии"],
        },
        {
          eyebrow: "Фаза старта",
          title: "Соревновательный контекст",
          value: "Подводка",
          points: ["Фаза, дни до старта, приоритет", "Контекст для готовности и адаптации"],
        },
        {
          eyebrow: "Синхронизация",
          title: "Офлайн-синхронизация",
          value: "Синхронизировано",
          points: ["Ожидает / готово / ошибка", "Надёжная очередь при плохой сети"],
        },
      ],
      footerNotes: [
        "Зона спортсмена",
        "Зона тренера",
        "Ежедневная готовность",
        "Контроль выполнения",
        "Соревновательный контекст",
        "Офлайн-синхронизация",
      ],
    },
    finalCta: {
      eyebrow: "PERFORM",
      title: "PERFORM - система для тренера, который принимает решения на основе данных",
      text:
        "Запустите платформу, добавьте спортсменов, назначьте план и контролируйте готовность каждый день. Рабочая зона, готовность, выполнение и аналитика уже доступны.",
      primary: "Начать работу",
      secondary: "Войти",
    },
    footer: {
      login: "Вход",
      copyright: "© 2026 PERFORM. Платформа тренировочного процесса.",
      tagline: "Система управления тренировочным процессом",
    },
  },
  bg: {
    code: "BG",
    languageLabel: "Език",
    brandTagline: "Данни. Анализ. Резултат.",
    nav: [
      { href: "#coach", label: "За треньора" },
      { href: "#athlete", label: "За спортиста" },
      { href: "#club", label: "За клуба" },
      { href: "#features", label: "Възможности" },
      { href: "#readiness", label: "Готовност" },
    ],
    header: {
      ariaLabel: "Основна навигация",
      login: "Вход",
      register: "Начало",
    },
    hero: {
      eyebrow: "Система за управление на тренировъчния процес",
      title: "Управлявайте тренировъчния процес на база данни",
      subtitle:
        "PERFORM помага на треньора да вижда готовността на спортиста, да контролира натоварването, да следи съня, пулса, теглото и самочувствието и да адаптира тренировъчния ден преди началото на работата.",
      primary: "Започнете",
      secondary: "Вижте възможностите",
      note: "За треньори, спортисти, отбори и спортни клубове.",
      chips: [
        "Готовност за под 30 секунди",
        "План и изпълнение на един екран",
        "Адаптиране според статуса на деня",
        "Собствен сървър за отбор или клуб",
      ],
    },
    dashboard: {
      statusLabel: "Статус за днес",
      systemLabel: "Тренировъчна система",
      readinessLabel: "Готовност днес",
      readinessStatus: "Оптимална",
      metrics: [
        { label: "Сън", value: "8 ч 20 мин" },
        { label: "Пулс", value: "43" },
        { label: "Тегло", value: "57.5 кг" },
        { label: "Самочувствие", value: "5/5" },
      ],
      recommendationLabel: "Препоръка",
      recommendation:
        "Основната тренировка е допустима; контролирайте обема след интензивния блок.",
      athleteWorkspace: "Работна зона на спортиста",
      dailyReadiness: "Дневна готовност",
      taper: "Тейпър",
      yellowDay: "Жълт ден",
      assignedDay: "Назначен тренировъчен ден",
      dayValue: "Ден 3",
      executionTracking: "Отчитане на изпълнението",
      executionValue: "2 / 3 блока",
      offlineSync: "Офлайн синхронизация",
      synced: "Синхронизирано",
      planningStudio: "Планиране",
      microcycle: "Микроцикъл преди старт",
    },
    features: {
      unifiedHead: {
        eyebrow: "Вместо разпилени данни",
        title: "Една система вместо таблици, съобщения и бележки",
        intro:
          "PERFORM събира дневните сигнали, плана, реалното изпълнение и контекста на подготовката в един продукт, а не в отделни таблици и чатове.",
      },
      unifiedCards: [
        {
          eyebrow: "Данни за спортиста",
          title: "Сън, тегло, пулс и субективни сигнали в един процес",
          description:
            "Сън, тегло, пулс, самочувствие, мускулна болезненост, мотивация и болка се събират в един работен екран.",
          visual: "signals",
        },
        {
          eyebrow: "План за деня",
          title: "Тренировъчният ден е оформен като работна задача",
          description:
            "Треньорът назначава тренировъчни дни, сесии, блокове и упражнения. Спортистът вижда само актуалната задача.",
          visual: "calendar",
        },
        {
          eyebrow: "Готовност",
          title: "Статусът на деня се изчислява преди натоварването",
          description:
            "Системата изчислява готовността за деня и показва статус: зелен, жълт или червен.",
          visual: "dots",
        },
        {
          eyebrow: "Адаптиране",
          title: "Натоварването се коригира по правила, не на око",
          description:
            "При понижена готовност системата подсказва кой блок да бъде намален, премахнат или заменен.",
          visual: "bars",
        },
      ],
      capabilityHead: {
        eyebrow: "Ключови възможности",
        title: "Целият цикъл на решения преди, по време и след тренировка",
        intro:
          "Планирането, готовността, адаптирането, анализът и отчитането са свързани с реалния тренировъчен процес.",
      },
      featureCards: [
        {
          eyebrow: "Планиране",
          title: "Планиране на подготовката",
          description:
            "Създавайте тренировъчни планове, микроцикли, блокове и упражнения и ги назначавайте на конкретни спортисти.",
          visual: "bars",
        },
        {
          eyebrow: "Готовност",
          title: "Контрол на готовността",
          description:
            "Спортистът въвежда дневни данни, а треньорът вижда текущото състояние преди началото на натоварването.",
          visual: "dots",
        },
        {
          eyebrow: "Адаптиране",
          title: "Адаптиране на натоварването",
          description:
            "PERFORM помага да се реши дали планът да се изпълни изцяло, да се намали обемът или интензивността да се замени с възстановяване.",
          visual: "calendar",
        },
        {
          eyebrow: "Анализ",
          title: "Анализ на динамиката",
          description:
            "Тегло, сън, пулс, субективно състояние, изпълнение на плана и натоварване се показват в ясна динамика.",
          visual: "signals",
        },
      ],
    },
    roles: {
      eyebrow: "За кого",
      title: "PERFORM работи като единна работна система за отбора",
      intro:
        "Платформата обединява планиране, готовност и контрол на изпълнението в един процес за треньора, спортиста и клуба.",
      cards: [
        {
          id: "coach",
          eyebrow: "За треньора",
          title: "Контрол на отбора и решения преди натоварване",
          description:
            "Следене на всички спортисти, назначаване на планове, мониторинг на готовността, корекция на натоварването и подготовка за състезания.",
          points: [
            "Списък със спортисти и цветови статуси",
            "Назначаване на планове и контрол на изпълнението",
            "Преглед на изпълнението и анализ без излишни екрани",
          ],
        },
        {
          id: "athlete",
          eyebrow: "За спортиста",
          title: "Един ясен екран за всеки тренировъчен ден",
          description:
            "План за деня, въвеждане на данни, отбелязване на изпълнение, препоръки и работа от телефон.",
          points: [
            "Готовност за 20-30 секунди",
            "Адаптиран ден без объркване",
            "Изпълнение и синхронизация в работния процес",
          ],
        },
        {
          id: "club",
          eyebrow: "За клуба",
          title: "Обща система за треньори, групи и дългосрочен цикъл",
          description:
            "Единна система за треньори, групи, спортисти, състезания и дългосрочно развитие.",
          points: [
            "Един поток от данни вместо чатове и таблици",
            "Състезания, сезони и цикли в общ модел",
            "Разгръщане на собствен сървър",
          ],
        },
      ],
    },
    readiness: {
      eyebrow: "Статус на готовността",
      title: "Зелен, жълт, червен: ясно решение преди тренировка",
      intro:
        "Треньорът не гадае по усещане. Системата показва причините за статуса и предлага корекция преди основната работа.",
      statuses: [
        {
          tone: "green",
          label: "ЗЕЛЕН / Готов",
          title: "Планът се изпълнява изцяло",
          points: [
            "Основната задача за деня се запазва",
            "Качеството и обемът могат да следват плана",
            "Треньорът вижда ясен зелен сигнал",
          ],
        },
        {
          tone: "yellow",
          label: "ЖЪЛТ / Внимание",
          title: "Намалете обема и запазете качеството",
          points: [
            "Премахнете второстепенните блокове",
            "Оставете технически важната част от деня",
            "Контролирайте обема след интензивно натоварване",
          ],
        },
        {
          tone: "red",
          label: "ЧЕРВЕН / Риск",
          title: "Намалете натоварването и го заменете с възстановяване",
          points: [
            "Премахнете интензивността и уморяващите блокове",
            "Преместете деня към възстановяване или мобилност",
            "Не допускайте слепи решения под стрес",
          ],
        },
      ],
    },
    competition: {
      eyebrow: "Състезания и цикли",
      title: "Планиране на подготовката за състезания",
      intro:
        "PERFORM отчита състезанията, етапа на подготовка, дните до старта, микроциклите, мезоциклите и дългосрочните цели в един контекст на планиране.",
      cards: [
        {
          eyebrow: "Състезания",
          title: "Календар на стартовете",
          description:
            "Системата съхранява ключовите стартове и ги свързва с етапа на подготовка, готовността и назначаването на шаблони.",
          tag: "Планиране на стартове",
        },
        {
          eyebrow: "Подготовка за старт",
          title: "Тейпър и фазов контекст",
          description:
            "PERFORM отчита дните до старта, състоянието на тейпъра и приоритета на състезанието при адаптиране на тренировъчния ден.",
          tag: "Съобразено с тейпъра",
        },
        {
          eyebrow: "Контрол на теглото",
          title: "Тегло и предсъстезателен контрол",
          description:
            "Теглото, сутрешните сигнали и целевите граници остават свързани между готовността, анализа и прегледа на състезанията.",
          tag: "Контрол на теглото",
        },
        {
          eyebrow: "Пикова форма",
          title: "Планиране на пика",
          description:
            "Връзката между седмица, мезоцикъл и сезон помага да не се наруши тейпърът със случайно претоварване.",
          tag: "Пикова форма",
        },
        {
          eyebrow: "Олимпийски цикъл",
          title: "Дългосрочна траектория",
          description:
            "Сезоните, циклите и плановете за стартове стават част от един модел, а не отделни документи.",
          tag: "Олимпийски цикъл",
        },
      ],
    },
    product: {
      eyebrow: "Работно пространство",
      title: "Цялата работна зона на един екран",
      intro:
        "Демонстрацията използва реални елементи от текущата система: зона на спортиста, зона на треньора, дневна готовност, отчитане на изпълнението, състезателен контекст и офлайн синхронизация.",
      panelEyebrow: "Работна зона PERFORM",
      panelTitle: "Една работна зона за решенията на треньора и изпълнението на спортиста",
      panelMeta: "Спортист • Треньор • Планиране • Офлайн",
      cards: [
        {
          eyebrow: "Готовност",
          title: "Дневна готовност",
          value: "72%",
          points: ["Сън, пулс, тегло, самочувствие", "Статус на деня и причини за решението"],
        },
        {
          eyebrow: "Тренировъчен ден",
          title: "Назначен ден",
          value: "Ден 3",
          points: ["Сесии, блокове и упражнения", "Само актуалната задача за спортиста"],
        },
        {
          eyebrow: "Изпълнение",
          title: "Отчитане на изпълнението",
          value: "2 / 3",
          points: ["План и реално изпълнение", "Натоварване, RPE, продължителност и коментари"],
        },
        {
          eyebrow: "Фаза на старта",
          title: "Състезателен контекст",
          value: "Тейпър",
          points: ["Фаза, дни до старта, приоритет", "Контекст за готовност и адаптиране"],
        },
        {
          eyebrow: "Синхронизация",
          title: "Офлайн синхронизация",
          value: "Синхронизирано",
          points: ["Изчаква / готово / грешка", "Надеждна опашка при слаба мрежа"],
        },
      ],
      footerNotes: [
        "Зона на спортиста",
        "Зона на треньора",
        "Дневна готовност",
        "Отчитане на изпълнението",
        "Състезателен контекст",
        "Офлайн синхронизация",
      ],
    },
    finalCta: {
      eyebrow: "PERFORM",
      title: "PERFORM е система за треньори, които вземат решения на база данни",
      text:
        "Стартирайте платформата, добавете спортисти, назначете план и следете готовността всеки ден. Работната зона, готовността, изпълнението и анализът вече са налични.",
      primary: "Започнете",
      secondary: "Вход",
    },
    footer: {
      login: "Вход",
      copyright: "© 2026 PERFORM. Платформа за тренировъчен процес.",
      tagline: "Система за управление на тренировъчния процес",
    },
  },
} as const;

export type LandingLanguage = keyof typeof LANDING_COPY;
export type LandingCopy = (typeof LANDING_COPY)[LandingLanguage];
export type LandingTone = "green" | "yellow" | "red";

export const LANDING_LANGUAGE_OPTIONS: Array<{
  value: LandingLanguage;
  label: string;
}> = [
  { value: "ru", label: "Русский" },
  { value: "bg", label: "Български" },
];

function firstValue(value: SearchParamValue) {
  return Array.isArray(value) ? value[0] : value;
}

export function isLandingLanguage(value: string | undefined): value is LandingLanguage {
  return value === "en" || value === "ru" || value === "bg";
}

export function resolveLandingLanguage(
  searchParams: Record<string, SearchParamValue> | undefined,
): LandingLanguage {
  const value = firstValue(searchParams?.language ?? searchParams?.lang);
  return isLandingLanguage(value) ? value : "ru";
}

export function landingLanguageHref(language: LandingLanguage) {
  return `/?language=${language}`;
}

export function workspaceAuthHref(auth: "login" | "register", language: LandingLanguage) {
  return `/workspace?auth=${auth}&language=${language}`;
}
