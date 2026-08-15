// escada-product-v8: closed-world competency knowledge base.
// Derived only from the supplied Digital Marketing competency scale.

export const knowledgeBaseVersion = 'digital-marketing-competency-scale-2026-08-v1'
export const levelOrder = ['specialist', 'senior', 'lead']
export const levelLabels = { specialist: 'Специалист', senior: 'Старший специалист', lead: 'Ведущий специалист' }

export const competencyKnowledge = [
  {
    "id": "strategic-thinking",
    "title": "Стратегическое цифровое маркетинг-мышление",
    "shortTitle": "Стратегия",
    "domain": "strategy",
    "summary": "Понимать бизнес-цели, видеть точки роста и принимать маркетинговые решения на основе данных.",
    "levels": {
      "specialist": [
        {
          "id": "strategic-thinking.specialist.01",
          "text": "Следует установленной маркетинг-стратегии и понимает её цели.",
          "sourcePage": 2
        },
        {
          "id": "strategic-thinking.specialist.02",
          "text": "Участвует в сборе данных и подготовке предложений.",
          "sourcePage": 2
        },
        {
          "id": "strategic-thinking.specialist.03",
          "text": "Понимает базовые метрики, цели и конкурентную среду.",
          "sourcePage": 2
        },
        {
          "id": "strategic-thinking.specialist.04",
          "text": "Предлагает небольшие улучшения в рамках текущего подхода.",
          "sourcePage": 2
        },
        {
          "id": "strategic-thinking.specialist.05",
          "text": "Упаковывает ценности бренда в контент, заметный на фоне ИИ-шума.",
          "sourcePage": 2
        },
        {
          "id": "strategic-thinking.specialist.06",
          "text": "Использует промпт-инжиниринг в операционной работе.",
          "sourcePage": 2
        },
        {
          "id": "strategic-thinking.specialist.07",
          "text": "Соблюдает единство бренда и сообщений во всех каналах.",
          "sourcePage": 2
        }
      ],
      "senior": [
        {
          "id": "strategic-thinking.senior.01",
          "text": "Декомпозирует стратегию на конкретные ежедневные задачи.",
          "sourcePage": 2
        },
        {
          "id": "strategic-thinking.senior.02",
          "text": "Предлагает тактические элементы стратегии и обоснованные гипотезы роста.",
          "sourcePage": 2
        },
        {
          "id": "strategic-thinking.senior.03",
          "text": "Анализирует конкурентов и предлагает решения.",
          "sourcePage": 2
        },
        {
          "id": "strategic-thinking.senior.04",
          "text": "Адаптирует стратегию под канал или регион.",
          "sourcePage": 2
        },
        {
          "id": "strategic-thinking.senior.05",
          "text": "Принимает решения на основе данных, а не только интуиции.",
          "sourcePage": 2
        },
        {
          "id": "strategic-thinking.senior.06",
          "text": "Управляет восприятием бренда в регионе, сохраняя общую концепцию.",
          "sourcePage": 3
        },
        {
          "id": "strategic-thinking.senior.07",
          "text": "Использует ИИ и deep search для ускорения рабочих процессов.",
          "sourcePage": 3
        }
      ],
      "lead": [
        {
          "id": "strategic-thinking.lead.01",
          "text": "Генерирует крупные инициативы с прогнозируемым бизнес-эффектом.",
          "sourcePage": 3
        },
        {
          "id": "strategic-thinking.lead.02",
          "text": "Управляет стратегическим развитием каналов и формирует стандарты команды.",
          "sourcePage": 3
        },
        {
          "id": "strategic-thinking.lead.03",
          "text": "Видит долгосрочные тренды и быстро адаптирует стратегию.",
          "sourcePage": 3
        },
        {
          "id": "strategic-thinking.lead.04",
          "text": "Использует предиктивные модели и deep search для планирования.",
          "sourcePage": 3
        },
        {
          "id": "strategic-thinking.lead.05",
          "text": "Выступает архитектором внедрения ИИ в отдел.",
          "sourcePage": 3
        }
      ]
    }
  },
  {
    "id": "analytics",
    "title": "Аналитика и работа с данными",
    "shortTitle": "Аналитика",
    "domain": "craft",
    "summary": "Находить в данных причины изменений и превращать их в конкретные действия.",
    "levels": {
      "specialist": [
        {
          "id": "analytics.specialist.01",
          "text": "Собирает данные и сдаёт отчёты регулярно и в срок.",
          "sourcePage": 3
        },
        {
          "id": "analytics.specialist.02",
          "text": "Использует Power BI, Google Analytics и Brand24 по стандартным сценариям.",
          "sourcePage": 3
        },
        {
          "id": "analytics.specialist.03",
          "text": "Понимает KPI по registrations, retention, costs, reach и другим показателям.",
          "sourcePage": 4
        },
        {
          "id": "analytics.specialist.04",
          "text": "Анализирует основные отклонения и тенденции поведения пользователей.",
          "sourcePage": 4
        },
        {
          "id": "analytics.specialist.05",
          "text": "Своевременно сигнализирует об изменениях в данных.",
          "sourcePage": 4
        }
      ],
      "senior": [
        {
          "id": "analytics.senior.01",
          "text": "Выявляет причинно-следственные связи и строит гипотезы.",
          "sourcePage": 4
        },
        {
          "id": "analytics.senior.02",
          "text": "Предлагает решения с измеримым влиянием на бизнес-метрики.",
          "sourcePage": 4
        },
        {
          "id": "analytics.senior.03",
          "text": "Оценивает кросс-канальное влияние и корреляции эффективности.",
          "sourcePage": 4
        }
      ],
      "lead": [
        {
          "id": "analytics.lead.01",
          "text": "Строит маркетинговые прогнозы по региону.",
          "sourcePage": 4
        },
        {
          "id": "analytics.lead.02",
          "text": "Обучает команду единым стандартам аналитики.",
          "sourcePage": 4
        },
        {
          "id": "analytics.lead.03",
          "text": "Прогнозирует влияние стратегии на costs, registrations, retention и CAC.",
          "sourcePage": 4
        },
        {
          "id": "analytics.lead.04",
          "text": "Формирует методологию оценки эффективности в аналитических инструментах.",
          "sourcePage": 4
        }
      ]
    }
  },
  {
    "id": "web-product",
    "title": "Управление веб-продуктом и контент-платформами",
    "shortTitle": "Веб-продукт",
    "domain": "craft",
    "summary": "Управлять сайтом, контентом, локализацией, промо и конверсионными сценариями.",
    "levels": {
      "specialist": [
        {
          "id": "web-product.specialist.01",
          "text": "Обновляет локальный контент сайта, корректирует и вычитывает материалы.",
          "sourcePage": 5
        },
        {
          "id": "web-product.specialist.02",
          "text": "Запускает промо, формы, опросы и другие региональные элементы.",
          "sourcePage": 5
        },
        {
          "id": "web-product.specialist.03",
          "text": "Пишет и редактирует тексты для разделов сайта.",
          "sourcePage": 5
        },
        {
          "id": "web-product.specialist.04",
          "text": "Предлагает точечные улучшения адаптивности контента под регион.",
          "sourcePage": 5
        },
        {
          "id": "web-product.specialist.05",
          "text": "Сопровождает релизы и обновления сайта.",
          "sourcePage": 5
        },
        {
          "id": "web-product.specialist.06",
          "text": "Контролирует качество локализации.",
          "sourcePage": 5
        },
        {
          "id": "web-product.specialist.07",
          "text": "Знает функции продукта и региональную терминологию.",
          "sourcePage": 5
        }
      ],
      "senior": [
        {
          "id": "web-product.senior.01",
          "text": "Эффективно взаимодействует с разработкой и дизайном.",
          "sourcePage": 5
        },
        {
          "id": "web-product.senior.02",
          "text": "Контролирует корректность запуска промо-элементов и форм.",
          "sourcePage": 5
        },
        {
          "id": "web-product.senior.03",
          "text": "Быстро реагирует на изменения сайта и продукта.",
          "sourcePage": 5
        },
        {
          "id": "web-product.senior.04",
          "text": "Помогает коллегам осваивать методы работы с сайтом и продуктом.",
          "sourcePage": 5
        },
        {
          "id": "web-product.senior.05",
          "text": "Активно участвует в подготовке релизов.",
          "sourcePage": 6
        }
      ],
      "lead": [
        {
          "id": "web-product.lead.01",
          "text": "Влияет на конверсионные пути и SEO-стратегию региона.",
          "sourcePage": 6
        },
        {
          "id": "web-product.lead.02",
          "text": "Помогает команде внедрять новые методы и инструменты работы с сайтом и продуктом.",
          "sourcePage": 6
        }
      ]
    }
  },
  {
    "id": "content-marketing",
    "title": "Контент-маркетинг и продакшен экспертных материалов",
    "shortTitle": "Контент",
    "domain": "craft",
    "summary": "Создавать контент, который решает задачи аудитории и бизнеса.",
    "levels": {
      "specialist": [
        {
          "id": "content-marketing.specialist.01",
          "text": "Создаёт структурированный и фактически точный контент по ТЗ.",
          "sourcePage": 6
        },
        {
          "id": "content-marketing.specialist.02",
          "text": "Проводит конкурентный анализ и готовит сравнения.",
          "sourcePage": 6
        },
        {
          "id": "content-marketing.specialist.03",
          "text": "Запускает исследования и создаёт материалы по их результатам.",
          "sourcePage": 6
        },
        {
          "id": "content-marketing.specialist.04",
          "text": "Следует контент-плану и соблюдает сроки.",
          "sourcePage": 6
        },
        {
          "id": "content-marketing.specialist.05",
          "text": "Редактирует работу внешних авторов по структуре, стилю и фактам.",
          "sourcePage": 6
        },
        {
          "id": "content-marketing.specialist.06",
          "text": "Адаптирует ИИ-контент под аудиторию, бренд и регион.",
          "sourcePage": 6
        }
      ],
      "senior": [
        {
          "id": "content-marketing.senior.01",
          "text": "Создаёт сложные экспертные материалы: гайды, презентации, вебинары.",
          "sourcePage": 7
        },
        {
          "id": "content-marketing.senior.02",
          "text": "Влияет на tone of voice рынка.",
          "sourcePage": 7
        },
        {
          "id": "content-marketing.senior.03",
          "text": "Отслеживает маркетинговые тренды и инициирует изменения подхода.",
          "sourcePage": 7
        },
        {
          "id": "content-marketing.senior.04",
          "text": "Отвечает за результат контент-плана региона.",
          "sourcePage": 7
        }
      ],
      "lead": [
        {
          "id": "content-marketing.lead.01",
          "text": "Формирует региональную контент-стратегию.",
          "sourcePage": 7
        },
        {
          "id": "content-marketing.lead.02",
          "text": "Разрабатывает и обновляет гайдлайны.",
          "sourcePage": 7
        },
        {
          "id": "content-marketing.lead.03",
          "text": "Запускает крупные контент-проекты и серии материалов.",
          "sourcePage": 7
        },
        {
          "id": "content-marketing.lead.04",
          "text": "Выступает экспертом в бренд-коммуникациях.",
          "sourcePage": 7
        },
        {
          "id": "content-marketing.lead.05",
          "text": "Интегрирует релевантные маркетинговые и ИИ-тренды в стратегию.",
          "sourcePage": 7
        }
      ]
    }
  },
  {
    "id": "smm-community",
    "title": "Управление SMM и комьюнити",
    "shortTitle": "SMM",
    "domain": "craft",
    "summary": "Развивать социальные каналы, аудиторию, вовлечённость и трафик.",
    "levels": {
      "specialist": [
        {
          "id": "smm-community.specialist.01",
          "text": "Модерирует сообщества и комментарии по гайдлайнам.",
          "sourcePage": 8
        },
        {
          "id": "smm-community.specialist.02",
          "text": "Готовит и публикует контент по утверждённому плану.",
          "sourcePage": 8
        },
        {
          "id": "smm-community.specialist.03",
          "text": "Помогает отслеживать базовые метрики вовлечённости.",
          "sourcePage": 8
        }
      ],
      "senior": [
        {
          "id": "smm-community.senior.01",
          "text": "Разрабатывает SMM-стратегию и контент-планы рынка.",
          "sourcePage": 8
        },
        {
          "id": "smm-community.senior.02",
          "text": "Создаёт текстовый, графический и видео-контент для вовлечения и лидогенерации.",
          "sourcePage": 8
        },
        {
          "id": "smm-community.senior.03",
          "text": "Управляет KPI по охвату, вовлечённости, трафику и регистрациям.",
          "sourcePage": 8
        },
        {
          "id": "smm-community.senior.04",
          "text": "Организует активности для роста комьюнити.",
          "sourcePage": 8
        }
      ],
      "lead": [
        {
          "id": "smm-community.lead.01",
          "text": "Формирует региональную стратегию сообществ и присутствия бренда.",
          "sourcePage": 8
        },
        {
          "id": "smm-community.lead.02",
          "text": "Анализирует эффективность каналов и распределяет активности.",
          "sourcePage": 8
        },
        {
          "id": "smm-community.lead.03",
          "text": "Внедряет новые инструменты и форматы роста аудитории.",
          "sourcePage": 8
        },
        {
          "id": "smm-community.lead.04",
          "text": "Руководит проектами развития комьюнити.",
          "sourcePage": 8
        },
        {
          "id": "smm-community.lead.05",
          "text": "Развивает трендовый визуальный и видео-контент.",
          "sourcePage": 8
        }
      ]
    }
  },
  {
    "id": "pr-reputation",
    "title": "PR и управление репутацией",
    "shortTitle": "PR",
    "domain": "craft",
    "summary": "Развивать узнаваемость и экспертность бренда через PR и внешние коммуникации.",
    "levels": {
      "specialist": [
        {
          "id": "pr-reputation.specialist.01",
          "text": "Мониторит упоминания бренда и ключевых тем без пропуска критических сообщений.",
          "sourcePage": 9
        },
        {
          "id": "pr-reputation.specialist.02",
          "text": "Готовит базовые PR-материалы по стандартам и в срок.",
          "sourcePage": 9
        },
        {
          "id": "pr-reputation.specialist.03",
          "text": "Обрабатывает запросы СМИ и блогеров по регламентам.",
          "sourcePage": 9
        }
      ],
      "senior": [
        {
          "id": "pr-reputation.senior.01",
          "text": "Разрабатывает и реализует PR-планы рынка.",
          "sourcePage": 9
        },
        {
          "id": "pr-reputation.senior.02",
          "text": "Работает с блогерами, журналистами и СМИ ради качественных публикаций.",
          "sourcePage": 9
        },
        {
          "id": "pr-reputation.senior.03",
          "text": "Создаёт истории успеха и экспертные статьи для репутационных кампаний.",
          "sourcePage": 9
        },
        {
          "id": "pr-reputation.senior.04",
          "text": "Участвует в кризисных коммуникациях.",
          "sourcePage": 9
        }
      ],
      "lead": [
        {
          "id": "pr-reputation.lead.01",
          "text": "Формирует комплексную репутационную стратегию региона.",
          "sourcePage": 9
        },
        {
          "id": "pr-reputation.lead.02",
          "text": "Инициирует крупные PR-проекты и партнёрства.",
          "sourcePage": 9
        },
        {
          "id": "pr-reputation.lead.03",
          "text": "Контролирует бюджеты и распределение PR-активностей.",
          "sourcePage": 10
        },
        {
          "id": "pr-reputation.lead.04",
          "text": "Строит стратегию работы с лидерами мнений и аналитиками.",
          "sourcePage": 10
        }
      ]
    }
  },
  {
    "id": "adaptability",
    "title": "Гибкость и скорость адаптации",
    "shortTitle": "Адаптивность",
    "domain": "leadership",
    "summary": "Быстро адаптироваться, тестировать новые подходы и реагировать на изменения.",
    "levels": {
      "specialist": [
        {
          "id": "adaptability.specialist.01",
          "text": "Стабильно работает по инструкциям и регламентам.",
          "sourcePage": 10
        },
        {
          "id": "adaptability.specialist.02",
          "text": "Быстро реагирует на изменение задач без потери качества.",
          "sourcePage": 10
        },
        {
          "id": "adaptability.specialist.03",
          "text": "Тестирует гипотезы и осваивает инструменты по заданному алгоритму.",
          "sourcePage": 10
        }
      ],
      "senior": [
        {
          "id": "adaptability.senior.01",
          "text": "Самостоятельно предлагает альтернативные решения при изменениях.",
          "sourcePage": 10
        },
        {
          "id": "adaptability.senior.02",
          "text": "Проактивно запускает и анализирует A/B-тесты и пилоты.",
          "sourcePage": 10
        },
        {
          "id": "adaptability.senior.03",
          "text": "Адаптирует тактику к изменениям рынка, продукта и процессов.",
          "sourcePage": 10
        }
      ],
      "lead": [
        {
          "id": "adaptability.lead.01",
          "text": "Внедряет системные процессы быстрого тестирования гипотез.",
          "sourcePage": 11
        },
        {
          "id": "adaptability.lead.02",
          "text": "Предвидит необходимость изменений и корректирует стратегии.",
          "sourcePage": 11
        },
        {
          "id": "adaptability.lead.03",
          "text": "Создаёт культуру гибкости и непрерывного улучшения.",
          "sourcePage": 11
        }
      ]
    }
  },
  {
    "id": "results-proactivity",
    "title": "Ориентация на результат и проактивность",
    "shortTitle": "Результат",
    "domain": "leadership",
    "summary": "Не только выполнять задачи, но и самостоятельно искать возможности улучшить результат.",
    "levels": {
      "specialist": [
        {
          "id": "results-proactivity.specialist.01",
          "text": "Выполняет задачи качественно и в срок.",
          "sourcePage": 11
        },
        {
          "id": "results-proactivity.specialist.02",
          "text": "Отслеживает KPI и стремится достичь их при поддержке руководителя.",
          "sourcePage": 11
        },
        {
          "id": "results-proactivity.specialist.03",
          "text": "Предлагает точечные улучшения и оптимизирует рутину.",
          "sourcePage": 11
        }
      ],
      "senior": [
        {
          "id": "results-proactivity.senior.01",
          "text": "Самостоятельно достигает бизнес-результатов по ключевым метрикам.",
          "sourcePage": 11
        },
        {
          "id": "results-proactivity.senior.02",
          "text": "Проактивно предлагает решения для роста продукта и процессов.",
          "sourcePage": 12
        },
        {
          "id": "results-proactivity.senior.03",
          "text": "Развивает вверенные каналы, тестирует гипотезы и делится выводами.",
          "sourcePage": 12
        }
      ],
      "lead": [
        {
          "id": "results-proactivity.lead.01",
          "text": "Несёт персональную ответственность за результат направления или рынка.",
          "sourcePage": 12
        },
        {
          "id": "results-proactivity.lead.02",
          "text": "Определяет приоритеты и распределяет ресурсы.",
          "sourcePage": 12
        },
        {
          "id": "results-proactivity.lead.03",
          "text": "Наставляет коллег и формирует сильную команду.",
          "sourcePage": 12
        },
        {
          "id": "results-proactivity.lead.04",
          "text": "Возглавляет эксперименты и масштабирует успешные практики.",
          "sourcePage": 12
        }
      ]
    }
  },
  {
    "id": "communication",
    "title": "Коммуникация и управление",
    "shortTitle": "Коммуникация",
    "domain": "leadership",
    "summary": "Чётко работать со стейкхолдерами, сроками, ожиданиями и рисками.",
    "levels": {
      "specialist": [
        {
          "id": "communication.specialist.01",
          "text": "Своевременно и ясно сообщает статус задач.",
          "sourcePage": 12
        },
        {
          "id": "communication.specialist.02",
          "text": "Уточняет требования, чтобы исключить ошибки на старте.",
          "sourcePage": 12
        },
        {
          "id": "communication.specialist.03",
          "text": "Взаимодействует со стейкхолдерами по установленным процессам.",
          "sourcePage": 12
        },
        {
          "id": "communication.specialist.04",
          "text": "Точно передаёт результаты в принятых форматах.",
          "sourcePage": 12
        }
      ],
      "senior": [
        {
          "id": "communication.senior.01",
          "text": "Управляет коммуникацией проектов и аргументирует решения.",
          "sourcePage": 12
        },
        {
          "id": "communication.senior.02",
          "text": "Проактивно управляет ожиданиями по срокам, объёму и приоритетам.",
          "sourcePage": 13
        },
        {
          "id": "communication.senior.03",
          "text": "Предотвращает и разрешает операционные конфликты.",
          "sourcePage": 13
        },
        {
          "id": "communication.senior.04",
          "text": "Документирует процессы коммуникации.",
          "sourcePage": 13
        }
      ],
      "lead": [
        {
          "id": "communication.lead.01",
          "text": "Является владельцем коммуникации направления.",
          "sourcePage": 13
        },
        {
          "id": "communication.lead.02",
          "text": "Ведёт сложные кросс-функциональные проекты.",
          "sourcePage": 13
        },
        {
          "id": "communication.lead.03",
          "text": "Формирует стандарты и лучшие практики коммуникации.",
          "sourcePage": 13
        }
      ]
    }
  },
  {
    "id": "ownership",
    "title": "Самостоятельность и ответственность",
    "shortTitle": "Ответственность",
    "domain": "leadership",
    "summary": "Самостоятельно организовывать работу, принимать решения и отвечать за результат.",
    "levels": {
      "specialist": [
        {
          "id": "ownership.specialist.01",
          "text": "Выполняет задачи в рамках поставленных целей.",
          "sourcePage": 13
        },
        {
          "id": "ownership.specialist.02",
          "text": "Берёт ответственность за свою часть работы.",
          "sourcePage": 13
        },
        {
          "id": "ownership.specialist.03",
          "text": "Сообщает о рисках и проблемах.",
          "sourcePage": 13
        },
        {
          "id": "ownership.specialist.04",
          "text": "Требует периодической приоритизации руководителем.",
          "sourcePage": 13
        }
      ],
      "senior": [
        {
          "id": "ownership.senior.01",
          "text": "Сам организует работу и приоритеты своей зоны.",
          "sourcePage": 14
        },
        {
          "id": "ownership.senior.02",
          "text": "Полностью отвечает за результат проектов и инициатив.",
          "sourcePage": 14
        },
        {
          "id": "ownership.senior.03",
          "text": "Принимает решения в рамках полномочий.",
          "sourcePage": 14
        },
        {
          "id": "ownership.senior.04",
          "text": "Улучшает процессы и помогает младшим коллегам.",
          "sourcePage": 14
        }
      ],
      "lead": [
        {
          "id": "ownership.lead.01",
          "text": "Принимает решения с учётом долгосрочного влияния на бизнес.",
          "sourcePage": 14
        },
        {
          "id": "ownership.lead.02",
          "text": "Отвечает за результат команды или рынка.",
          "sourcePage": 14
        },
        {
          "id": "ownership.lead.03",
          "text": "Развивает других и масштабирует лучшие практики.",
          "sourcePage": 14
        }
      ]
    }
  },
  {
    "id": "intercultural",
    "title": "Международная и межкультурная чувствительность",
    "shortTitle": "Локализация",
    "domain": "strategy",
    "summary": "Учитывать особенности локального рынка, культуры, языка и коммуникации.",
    "levels": {
      "specialist": [
        {
          "id": "intercultural.specialist.01",
          "text": "Следует локальным гайдлайнам и рекомендациям.",
          "sourcePage": 14
        },
        {
          "id": "intercultural.specialist.02",
          "text": "Понимает особенности бизнеса и маркетинга региона.",
          "sourcePage": 14
        },
        {
          "id": "intercultural.specialist.03",
          "text": "Корректно использует язык и tone of voice.",
          "sourcePage": 14
        },
        {
          "id": "intercultural.specialist.04",
          "text": "Учитывает культурные различия и обращается за помощью при сомнениях.",
          "sourcePage": 14
        },
        {
          "id": "intercultural.specialist.05",
          "text": "Поддерживает имидж бренда.",
          "sourcePage": 14
        }
      ],
      "senior": [
        {
          "id": "intercultural.senior.01",
          "text": "Самостоятельно адаптирует контент и кампании под рынок.",
          "sourcePage": 15
        },
        {
          "id": "intercultural.senior.02",
          "text": "Учитывает культурные особенности при планировании.",
          "sourcePage": 15
        },
        {
          "id": "intercultural.senior.03",
          "text": "Предотвращает репутационные риски.",
          "sourcePage": 15
        },
        {
          "id": "intercultural.senior.04",
          "text": "Эффективно работает с международными подрядчиками.",
          "sourcePage": 15
        }
      ],
      "lead": [
        {
          "id": "intercultural.lead.01",
          "text": "Консультирует команду по межкультурным вопросам.",
          "sourcePage": 15
        },
        {
          "id": "intercultural.lead.02",
          "text": "Прогнозирует региональные риски и результат.",
          "sourcePage": 15
        },
        {
          "id": "intercultural.lead.03",
          "text": "Отвечает за репутацию бренда в международном контексте.",
          "sourcePage": 15
        }
      ]
    }
  },
  {
    "id": "paid-acquisition",
    "title": "Управление рекламными каналами и привлечением трафика",
    "shortTitle": "Performance",
    "domain": "craft",
    "summary": "Привлекать пользователей через рекламу и повышать эффективность рекламных инвестиций.",
    "levels": {
      "specialist": [
        {
          "id": "paid-acquisition.specialist.01",
          "text": "Запускает Google Ads по шаблону и поставленным задачам.",
          "sourcePage": 15
        },
        {
          "id": "paid-acquisition.specialist.02",
          "text": "Проводит A/B-тесты по инструкции.",
          "sourcePage": 15
        },
        {
          "id": "paid-acquisition.specialist.03",
          "text": "Следит за CTR, CPC, registrations, retention, CAC, sessions и другими метриками.",
          "sourcePage": 15
        },
        {
          "id": "paid-acquisition.specialist.04",
          "text": "Контролирует бюджет и стремится выполнить KPI.",
          "sourcePage": 15
        },
        {
          "id": "paid-acquisition.specialist.05",
          "text": "Еженедельно оптимизирует тексты и расширения.",
          "sourcePage": 15
        },
        {
          "id": "paid-acquisition.specialist.06",
          "text": "Сигнализирует об отклонениях аукциона и расходов.",
          "sourcePage": 16
        }
      ],
      "senior": [
        {
          "id": "paid-acquisition.senior.01",
          "text": "Совместно с online marketing строит и оптимизирует структуру кампаний.",
          "sourcePage": 16
        },
        {
          "id": "paid-acquisition.senior.02",
          "text": "Формирует гипотезы роста и снижения стоимости регистрации и retention.",
          "sourcePage": 16
        },
        {
          "id": "paid-acquisition.senior.03",
          "text": "Меняет подход в зависимости от динамики рынка.",
          "sourcePage": 16
        },
        {
          "id": "paid-acquisition.senior.04",
          "text": "Отвечает за эффективность платного привлечения региона.",
          "sourcePage": 16
        },
        {
          "id": "paid-acquisition.senior.05",
          "text": "Предлагает обоснованные изменения Google Ads стратегии.",
          "sourcePage": 16
        }
      ],
      "lead": [
        {
          "id": "paid-acquisition.lead.01",
          "text": "Участвует в формировании performance-маркетинг стратегии региона.",
          "sourcePage": 16
        },
        {
          "id": "paid-acquisition.lead.02",
          "text": "Участвует в запусках новых рынков и стран на языке региона.",
          "sourcePage": 16
        }
      ]
    }
  }
]

export const competencyKeywords = {
  "strategic-thinking": [
    "стратег",
    "рынок",
    "позиционирован",
    "конкурент",
    "гипотез",
    "тренд",
    "ии",
    "ai"
  ],
  "analytics": [
    "аналит",
    "данн",
    "метрик",
    "kpi",
    "конверси",
    "retention",
    "cac",
    "cost",
    "прогноз"
  ],
  "web-product": [
    "сайт",
    "лендинг",
    "web",
    "ux",
    "seo",
    "форма",
    "релиз",
    "локализац"
  ],
  "content-marketing": [
    "контент",
    "статья",
    "гайд",
    "вебинар",
    "редак",
    "tone of voice",
    "исследован"
  ],
  "smm-community": [
    "smm",
    "соцсет",
    "community",
    "комьюнити",
    "охват",
    "вовлеч",
    "пост",
    "видео"
  ],
  "pr-reputation": [
    "pr",
    "пиар",
    "сми",
    "журналист",
    "репутац",
    "публикац",
    "блогер",
    "кризис"
  ],
  "adaptability": [
    "адапт",
    "изменен",
    "эксперимент",
    "пилот",
    "a/b",
    "тест",
    "новый инструмент"
  ],
  "results-proactivity": [
    "результат",
    "эффект",
    "рост",
    "улучш",
    "достиг",
    "эконом",
    "влияние",
    "инициатив"
  ],
  "communication": [
    "коммуникац",
    "стейкхолдер",
    "встреч",
    "согласован",
    "конфликт",
    "презентац",
    "договор"
  ],
  "ownership": [
    "ответствен",
    "самостоятель",
    "владелец",
    "процесс",
    "решение",
    "ментор",
    "обучил"
  ],
  "intercultural": [
    "локальн",
    "культур",
    "регион",
    "международ",
    "язык",
    "рынок",
    "адаптац"
  ],
  "paid-acquisition": [
    "google ads",
    "реклама",
    "кампани",
    "ctr",
    "cpc",
    "регистрац",
    "трафик",
    "бюджет"
  ]
}

export const allCriteria = competencyKnowledge.flatMap((competency) =>
  levelOrder.flatMap((level) => competency.levels[level].map((criterion) => ({
    ...criterion,
    competencyId: competency.id,
    competencyTitle: competency.title,
    competencyShortTitle: competency.shortTitle,
    level,
  }))),
)

export function findCriterion(criterionId) {
  return allCriteria.find((criterion) => criterion.id === criterionId) ?? null
}

export function getCompetency(competencyId) {
  return competencyKnowledge.find((competency) => competency.id === competencyId) ?? null
}

export function nextLevel(level) {
  if (level === 'specialist') return 'senior'
  if (level === 'senior') return 'lead'
  return null
}
