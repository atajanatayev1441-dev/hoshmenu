# HOŞ Lounge — электронное меню (hs_menu)

Этот файл Claude Code читает автоматически. Тут всё, что нужно, чтобы продолжить работу без старых диалогов.
Полная история диалогов и инструкция по переносу лежат в `_перенос_на_новый_пк/` (папка не в git).

## Кто пользователь и как с ним работать
- Владелец кафе/лаунжа **HOŞ Lounge** (Туркменистан; в разделе «О нас»: тел. +99371667777, работа 8:00–23:00). Не программист.
- **Отвечать по-русски**, просто, без лишнего жаргона. Пишет коротко, часто с опечатками.
- Обычно просит «запушь и задеплой»: push в `master` → Railway сам пересобирает сайт (~2 мин). Пушить только когда просит.
- Никогда не просить токены в чат. GitHub-доступ — через `gh auth login`, Railway — `railway login`.
- Свинины ни в одном блюде нет (важно для описаний).

## Что это
Одностраничное меню (HTML+JS в одном файле) + маленький Express-сервер. Три «упаковки» одного и того же меню:

| Что | Где | Как собирается |
|---|---|---|
| Сайт + API | `server.js`, `www/index.html` | Railway, деплой из GitHub `master` |
| APK для планшета Galaxy Tab A11 (альбомная ориентация, работает офлайн) | `android-app/` (Capacitor 7) | `android-app/android` → `gradlew assembleRelease` |
| EXE для ПК | `desktop-app/` (Electron) | `cd desktop-app && npm run dist` |

- `index.html` в корне, `www/index.html` и `android-app/www/index.html` — **одна и та же страница, держать копии одинаковыми** (сейчас совпадают). `desktop-app/www/index.html` — своя, более старая копия.
- Старая папка `android/` в корне (appId `com.hoslounge.menu`) — первая версия APK, сейчас не используется. Актуальный APK — `android-app/` (appId `ru.hoscoffee.menu`, сейчас versionCode 3 / versionName 2.0, не закоммичено).

## Сервер и данные
- GitHub: `atajanatayev1441-dev/hoshmenu`, ветка `master`.
- Railway: проект **caring-playfulness**, environment production. Домены: **https://hoscoffee.ru** (основной) и запасной **https://hoshmenu-production.up.railway.app** (APK пробует их по очереди — на случай блокировки домена).
- Данные меню хранятся на Railway volume `/data/menu-data.json` (локально — `server-data/`, она в .gitignore). Сид: `server/data-seed.json`.
- API: `GET/POST /api/menu` (`{dishes, cats, promos, version}`), `POST /api/orders`, `GET /api/orders/recent`, `GET /api/orders/stats`. Каждый POST меню увеличивает `version`.
- Админка встроена в страницу. Правки из админки сразу сохраняются на сервер; фото, загруженные через админку, лежат в меню как base64 `data:` URL.
- **Главное: живые данные меню — на сервере, не в git.** Не перезаписывать `/api/menu` без явной просьбы. На 16.11.2026 живая версия — 607 (135 блюд, 14 категорий); копия — `_перенос_на_новый_пк/backup/`.

## Структура меню (кратко)
- Блюдо: `id, cat, names{ru,tk,en}, desc/descs, price, photo, badge (HIT/TOP/NEW)…`; категории с подкатегориями (например «Бар» → чаи, коктейли, кофе).
- Порядок категорий: Бар первым, потом Завтраки и т.д. Вход в меню — карточки категорий, внутри карточки блюд по 4 в ряд; кнопка «Все категории» прилипает при прокрутке.
- Акции (promos) управляются из админки.
- Корзина/заказ на планшете → `POST /api/orders`.

## Скрипты
- `node scripts/build-menu-import.js` — скачивает живое меню и собирает `android-app/menu-import.json` (JSON-массив категорий с `items` для импорта на другой сайт **hoscoffee.online** — это отдельный проект с своей админкой, меню туда только импортируется, синхронизации нет). Base64-фото сохраняет в `www/dishes/cloud-<id>-<hash>.jpg` (+ копия в `android-app/www/dishes/`). **После запуска закоммитить и запушить новые фото** — иначе их ссылки на сайте битые.
- `scripts/resize-dishes.js`, `dedupe*.js`, `contact-sheet*.js` — разовые скрипты обработки фото из папки `реальное меню/` (2.2 ГБ оригиналов, не в git; в приложении используются сжатые `dishes/`).

## Сборка APK (на этом ПК было так)
- JDK 21 (`JAVA_HOME=C:\Java\jdk-21.0.11+10`), Android SDK `C:\Android` (прописать в `android-app/android/local.properties`: `sdk.dir=C:\\Android`), Android Studio.
- Подпись: `android-app/android/keystore.properties` → `android-app/hoslounge-release.keystore`. **Оба файла не в git. Без keystore нельзя выпустить обновление поверх установленного APK** — их копии лежат в `_перенос_на_новый_пк/secrets/`.
- Готовые APK кладутся в `android-app/` (`hoslounge-menu-vX.Y.apk`). Для офлайна все фото блюд/категорий вшиты в `android-app/www/`.

## История (что уже сделано, по датам)
- 07.2026: APK под Galaxy Tab A11; разбор фото из «реальное меню» (убраны дубли); подкатегории; карточки 4 в ряд; описания 147 блюд; переезд на Railway-проект caring-playfulness; синхронизация между устройствами через сервер (вместо localStorage, была ошибка QuotaExceeded); сжатие фото при загрузке; карточки категорий; стрелки вместо свайпа; убраны пароль и быстрое редактирование; акции через админку; запасной домен; офлайн-APK; экспорт JSON для hoscoffee.online.
- 08.2026: JSON-массив для импорта с фото.
- 09.2026: EXE для ПК (Electron); обсуждалась отдельная ПК-программа-аналитика заказов с ИИ-ассистентом OpenAI (заказы с планшета → сервер → программа). Серверная часть заказов (`/api/orders*`) сделана.
- 06.10.2026: редизайн «тёплая тема», данные из облака; приветственный экран сайта как в APK.
- 31.10.2026: новый `menu-import.json` (версия 599, 137 блюд), выложены 47 фото из админки.

## Незавершённое на момент переноса (16.11.2026)
- Не закоммичено: `android-app/android/app/build.gradle` (версия 2.0), `android-app/www/index.html` (синхронизирован с `www/index.html`), `android-app/www/img/`, новые `android-app/www/dishes/*`, `Claude outputs/*.png`. Пользователь (22.11.2026): APK уже собран и установлен на планшетах — пересобирать не нужно без просьбы. Файла `hoslounge-menu-v2.0.apk` в папке нет (есть только v1.1, v1.2).

## iPad (.ipa, с 22.11.2026)
- iOS-проект Capacitor в `android-app/ios/` (SPM, без CocoaPods), то же меню из `android-app/www/`. Иконка/заставка — из `hosnewlogo.jpg` (круг на тёмном фоне).
- Mac нет: .ipa собирается на GitHub Actions (`.github/workflows/ios-ipa.yml`, macOS, без подписи) при пуше в `android-app/**` или вручную; результат — artifact `hoslounge-menu-ipad`.
- У пользователя iPad на iOS 16.7.8 (TrollStore не подходит) → ставит через **AltStore** с бесплатным Apple ID: продление раз в 7 дней через AltServer на ПК по Wi‑Fi.

- Имя в Info.plist — `HOS Lounge` (Apple не принимает Ş при регистрации App ID), «HOŞ Lounge» — через InfoPlist.strings. На iOS 16 не использовать `aspect-ratio` в сетках (высота через padding).

## Обновление и Новый год (25.11.2026)
- **Номер сборки** — в `index.html` два места: `<meta name="app-build">` и `var BUILD`. При каждой правке страницы увеличивать оба одинаково (ГГГГММДДNN), иначе кнопка «Обновить» в приложениях не увидит новую версию.
- Кнопка «Обновить» (админка): приложение скачивает `/api/app/html` с сервера, хранит в localStorage (`hs_ota`) и запускает вместо встроенной страницы; если дважды не запустилась — откат. Работает в iPad-версии v5+; APK 1.x/2.0 этого не умеют.
- Меню кэшируется в IndexedDB; раз в 15 с опрашивается лёгкий `/api/menu/version` ({version, theme, build}), полное меню качается только при смене версии.
- Новогодняя тема: класс `body.ny`, режим auto (20.11–20.01)/on/off в админке → `POST /api/theme`, хранится в `/data/settings.json`.

## Сборка APK без Java на ПК (25.11.2026)
- Ветка `apk-build` → workflow `android-apk.yml` собирает НЕподписанный APK (artifact `hoslounge-menu-apk-unsigned`); ключ в GitHub не загружать. Подпись на ПК: `node scripts/sign-apk.js sign <in> <out>` (схема v2, Android 7+), проверка: `verify`.
- Готов `android-app/hoslounge-menu-v2.1.apk` (versionCode 4, тот же ключ, что у v1.1/v1.2). Сборки перед выпуском: увеличить versionCode/versionName.

## Новый ПК (с 22.11.2026)
- Путь: `C:\Users\Admin\Desktop\hs_menu`. Диалоги/память восстановлены `restore.ps1`, `npm install` сделан во всех трёх папках.
- JDK 21 и Android SDK на этом ПК **не установлены** — сборка APK пока невозможна.
- Планшеты (APK) берут меню из интернета: `hoscoffee.ru` → запасной `hoshmenu-production.up.railway.app`. Локальный сервер на ПК им не нужен. На этом ПК hs_menu-сервер не запущен (порты 4300/8795 заняты другими проектами — Hasap, YAKUT).
- Живое меню ушло вперёд (v607 против 599 в последнем `menu-import.json`) — при следующем экспорте перезапустить скрипт.
