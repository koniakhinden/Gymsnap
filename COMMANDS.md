# GymSnap — шпаргалка по командам

Всё запускается **из корня проекта** — там, где лежат `package.json` и `.env.local`.
Проверить, что ты в нужном каталоге:

```bash
ls package.json .env.local.example
```

Нужен **Node 22 LTS**. На Node 25 падает esbuild внутри tsx
(`TransformError: The service was stopped`), и это ломает все команды на `tsx` —
`db:migrate`, `seed`, `images`.

```bash
node -v            # ожидается v22.x
nvm use 22         # если не она
```

---

## Первый запуск и после каждого `git pull`

```bash
git pull origin claude/new-session-35sm9k
npm install
npm run db:migrate      # накатывает всё, чего ещё нет в базе
npm run dev             # http://localhost:3000
```

`db:migrate` безопасно гонять сколько угодно: drizzle ведёт учёт применённого
в служебной таблице и пропускает то, что уже накатано.

---

## Переменные окружения

Живут в `.env.local` (в git не попадает). Шаблон — `.env.local.example`.

| Переменная | Зачем | Где брать |
|---|---|---|
| `DATABASE_URL` | база | Neon → Connection Details, пулерный хост |
| `ANTHROPIC_API_KEY` | планы, распознавание, `images specs` | console.anthropic.com |
| `BLOB_READ_WRITE_TOKEN` | хранение картинок | Vercel → Storage → Blob → `.env.local` |
| `OPENAI_API_KEY` | **только** `images generate` | platform.openai.com/api-keys |

`OPENAI_API_KEY` **не добавляется в Vercel**: генерация офлайновая, приложение
к OpenAI не ходит.

Вписать ключ из буфера обмена, не светя его на экране и в истории команд
(скопируй ключ, потом выполни):

```bash
K=$(pbpaste | tr -d '[:space:]')
if printf '%s' "$K" | grep -q '^sk-'; then
  [ -f .env.local ] || cp .env.local.example .env.local
  grep -v '^OPENAI_API_KEY=' .env.local > .env.local.new
  printf 'OPENAI_API_KEY=%s\n' "$K" >> .env.local.new
  mv .env.local.new .env.local
  echo "ключ записан"
else
  echo "в буфере обмена не ключ"
fi
unset K
```

Проверка без показа ключа:

```bash
grep -q '^OPENAI_API_KEY=sk-' .env.local && echo "на месте" || echo "нет"
```

---

## Разработка

```bash
npm run dev             # дев-сервер
npm run build           # прод-сборка, обязательна перед пушем
npm run lint            # eslint
npx tsc --noEmit        # проверка типов, включая scripts/
```

---

## База

```bash
npm run db:migrate      # применить миграции
npm run db:generate     # сгенерировать миграцию после правки lib/db/schema.ts
npm run seed            # залить ~900 упражнений; безопасно повторять
```

`db:generate` только диффит схему и подключение к базе не требует.
**Всегда читай получившийся SQL в `drizzle/` перед `db:migrate`** — база боевая,
отдельной локальной нет.

---

## Картинки упражнений: CLI

Флаги идут **после `--`**, иначе npm заберёт их себе. Позиционные аргументы
(`status`, id упражнения) можно писать без него.

```bash
npm run images status                        # спеки по версиям шаблона, картинки по статусам
npm run images -- top --limit 40             # рейтинг реальной выдачи; ничего не тратит

npm run images -- specs --top --limit 40      # спеки для самых выдаваемых — начинать отсюда
npm run images -- specs --limit 10           # спеки через Claude, только там где их нет
npm run images -- specs --only <id1>,<id2>   # пересчитать конкретные
npm run images -- specs --force --limit 50   # пересчитать всё подряд

npm run images -- generate --only <id> --dry # показать промпт, ничего не потратить
npm run images -- generate --top --limit 20   # рисовать в порядке реальной выдачи
npm run images -- generate --limit 3         # нарисовать, статус pending
npm run images -- generate --quality low     # то же дешевле, для сравнения

npm run images -- approve <id>               # pending -> active
npm run images -- reject <id> --note "гриф на пояснице"
npm run images -- rollback <id>              # вернуть предыдущую версию
npm run images -- rollback <id> --version 2  # вернуть конкретную
npm run images -- disable <id>               # вернуть упражнение на фото free-exercise-db
npm run images -- prune                      # удалить блобы забракованных версий
```

`--top` сортирует по тому, как часто упражнение реально попадало в планы, разминки,
растяжки и «Train now». Несколько сотен движений несут почти все планы, а длинный
хвост библиотеки может не понадобиться вообще — с него не стоит начинать.

`generate` берёт только упражнения без картинки в статусе `active` или `pending`,
поэтому повторный запуск не перерисовывает и не переоплачивает очередь на приёмку.
Прерывать можно в любой момент — следующий запуск продолжит с того же места.

**Сгенерированное не показывается в приложении само.** Нужен `approve` — командой
или со страницы приёмки.

---

## Картинки упражнений: страница

```bash
npm run dev
```

- http://localhost:3000/admin/images — очередь с фильтрами и пакетной генерацией.
  Галка «только реально выдававшиеся» оставляет упражнения, которые хотя бы раз
  попадали пользователю, и сортирует их по частоте; обе пакетные кнопки
  («Сделать спеки» и генерация картинок) считаются от этого же среза
- http://localhost:3000/admin/images/`<id>` — промпт, спека, результат, история
- http://localhost:3000/admin/images/review — приёмка потоком: `A` принять,
  `R` отклонить, `G` перегенерить, стрелки листать

**Только локально.** В прод-сборке страница и все её API-роуты отдают 404, ссылки
из навигации на неё нет. Каждый клик стоит денег, защиты никакой.

Подробности про статусы, откат и смену стиля — в [IMAGES.md](IMAGES.md).

---

## Если что-то не работает

| Симптом | Причина |
|---|---|
| `Missing script: "images"` | ты не в корне проекта |
| `Could not read package.json` | то же самое |
| `TransformError: The service was stopped` | Node 25, нужен Node 22 |
| `relation "exercise_images" does not exist` | не накатана миграция → `npm run db:migrate` |
| `OPENAI_API_KEY is not set` | ключа нет в `.env.local`, см. выше |
| страница `/admin/images` даёт 404 | ты открыл прод-сборку, а не `npm run dev` |
| `--limit` игнорируется | забыл `--` перед флагами |
