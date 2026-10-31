// Собирает android-app/menu-import.json (формат для импорта меню на сайт)
// из живого меню https://hoscoffee.ru/api/menu.
//
// Фото, загруженные через админку, хранятся в меню как base64 (data:...).
// Скрипт сохраняет их файлами www/dishes/cloud-<id>-<hash>.jpg (и копию в
// android-app/www/dishes), чтобы у каждого блюда была обычная https-ссылка.
// Хэш в имени меняется при замене фото — старая картинка из кэша не подсунется.
//
// Запуск: node scripts/build-menu-import.js [путь-к-menu.json]
// Без аргумента меню скачивается с сервера.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const SITE = 'https://hoscoffee.ru';
const PHOTO_DIRS = [path.join(ROOT, 'www', 'dishes'), path.join(ROOT, 'android-app', 'www', 'dishes')];
const OUT = path.join(ROOT, 'android-app', 'menu-import.json');

async function loadMenu() {
  const src = process.argv[2];
  if (src) return JSON.parse(fs.readFileSync(src, 'utf8'));
  const res = await fetch(SITE + '/api/menu');
  if (!res.ok) throw new Error('GET /api/menu: HTTP ' + res.status);
  return res.json();
}

function photoToUrl(dish, stats) {
  const p = dish.photo || '';
  if (!p) return '';
  if (/^https?:/.test(p)) return p;
  if (p.startsWith('data:')) {
    const m = p.match(/^data:image\/(\w+);base64,(.*)$/s);
    if (!m) throw new Error('Неизвестный формат фото у блюда ' + dish.id);
    const buf = Buffer.from(m[2], 'base64');
    const ext = m[1] === 'jpeg' ? 'jpg' : m[1];
    const hash = crypto.createHash('sha1').update(buf).digest('hex').slice(0, 8);
    const name = `cloud-${dish.id}-${hash}.${ext}`;
    for (const dir of PHOTO_DIRS) {
      const f = path.join(dir, name);
      if (!fs.existsSync(f)) { fs.writeFileSync(f, buf); stats.written.add(name); }
    }
    stats.inline++;
    return `${SITE}/dishes/${name}`;
  }
  const rel = p.replace(/^\//, '');
  if (!fs.existsSync(path.join(ROOT, 'www', rel))) stats.missing.push(`${dish.names.ru}: ${rel}`);
  return `${SITE}/${rel}`;
}

(async () => {
  const menu = await loadMenu();
  const stats = { inline: 0, written: new Set(), missing: [] };

  const out = menu.cats.map(cat => {
    const items = menu.dishes.filter(d => d.cat === cat.id).map(d => {
      const item = { name_ru: d.names.ru, name_tk: d.names.tk || d.names.ru };
      if (d.short && d.short.ru) item.description_ru = d.short.ru;
      if (d.short && d.short.tk) item.description_tk = d.short.tk;
      item.price = d.price;
      item.imageUrl = photoToUrl(d, stats);
      item.available = true;
      item.featured = !!d.badge;
      return item;
    });
    return { name_ru: cat.names.ru, name_tk: cat.names.tk || cat.names.ru, items };
  }).filter(c => c.items.length);

  const orphans = menu.dishes.filter(d => !menu.cats.some(c => c.id === d.cat));

  fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n');
  const total = out.reduce((n, c) => n + c.items.length, 0);
  console.log(`Меню версии ${menu.version}: ${out.length} категорий, ${total} блюд -> ${path.relative(ROOT, OUT)}`);
  console.log(`Встроенных фото: ${stats.inline}, новых файлов: ${stats.written.size}`);
  if (orphans.length) console.log('Блюда без категории (пропущены):', orphans.map(d => d.names.ru).join(', '));
  if (stats.missing.length) console.log('Фото не найдены локально:\n  ' + stats.missing.join('\n  '));
})().catch(e => { console.error(e.message); process.exit(1); });
