# Эскада

Личная профессиональная память сотрудника: быстрый захват идей и результатов,
превращение их в доказательства роста, понятный следующий карьерный шаг.

Продуктовое описание — см. `docs/ESCADA_PRODUCT_SPEC_V8.md` и
`docs/PRODUCT_CJM_AND_RECOMMENDATIONS.md`.

## Стек

- Next.js 15 (App Router), TypeScript, CSS Modules
- Статический экспорт (`output: 'export'`) для GitHub Pages
- Данные — в `localStorage` браузера, бэкенд для базовой работы не требуется
- Опциональная внешняя AI-подсказка через `NEXT_PUBLIC_ESCADA_AI_ENDPOINT`
  (не обязательна: без неё работает встроенный локальный guidance-движок,
  см. `app/career/local-guidance.mjs`)

## Разработка

```bash
npm ci
npm run dev          # локальный сервер разработки
npm run test:escada  # тесты (tests/escada-v8.test.mjs, tests/escada-v10.test.mjs)
npm run build         # статическая сборка в out/
```

## Деплой

Деплой на GitHub Pages выполняется автоматически через
`.github/workflows/deploy-pages.yml` при пуше в `main`. Пайплайн:

1. чекаутит именно запушенный коммит;
2. `npm ci`, тесты, `next build`;
3. штампует `out/deploy-version.txt` = SHA задеплоенного коммита.

Проверить, что прод соответствует `main`:

```bash
curl -fsSL https://saypavnik-code.github.io/career/deploy-version.txt
git rev-parse origin/main
```

Значения должны совпадать.

## Структура

```text
app/career/
  CareerDashboard.tsx      — весь UI приложения (client component)
  career.module.css        — дизайн-система August (CSS Modules)
  career-core.mjs           — состояние, миграции localStorage, доменная логика
  career-data.ts             — компетенции, уровни, статические данные
  competency-knowledge.mjs   — закрытая база критериев шкалы компетенций
  local-guidance.mjs         — локальный (без внешнего AI) guidance-движок
  ai-contract.mjs             — контракт запроса/ответа для guidance
docs/
  ESCADA_PRODUCT_SPEC_V7.md, ESCADA_PRODUCT_SPEC_V8.md — продуктовые спеки
  PRODUCT_CJM_AND_RECOMMENDATIONS.md — CJM пользователя и рекомендации
tests/
  escada-v8.test.mjs, escada-v10.test.mjs
```

## Принципы продукта

- Эскада — личная память сотрудника, не HR-система и не task-менеджер.
- Компетенции — ориентир, а не обязательный чеклист; никаких выдуманных процентов.
- AI/встроенная подсказка вызывается только явной кнопкой, никогда фоном.
- Данные не покидают устройство пользователя без явного экспорта.
