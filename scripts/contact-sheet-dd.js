const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const DD_JSON = process.argv[2];
const OUT_DIR = process.argv[3];
const PER_SHEET = 24; // 4 cols x 6 rows
const COLS = 4;
const CELL_W = 300;
const CELL_H = 270;
const IMG_H = 230;

(async () => {
  const dd = JSON.parse(fs.readFileSync(DD_JSON, 'utf8'));
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  for (let s = 0; s < Math.ceil(dd.length / PER_SHEET); s++) {
    const batch = dd.slice(s * PER_SHEET, (s + 1) * PER_SHEET);
    const rows = Math.ceil(batch.length / COLS);
    const sheetW = COLS * CELL_W;
    const sheetH = rows * CELL_H;

    const composites = [];
    for (let i = 0; i < batch.length; i++) {
      const d = batch[i];
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const thumbBuf = await sharp(path.join(__dirname, '..', d.photo))
        .resize(CELL_W - 20, IMG_H, { fit: 'inside' })
        .toBuffer();
      const meta = await sharp(thumbBuf).metadata();
      const x = col * CELL_W + Math.round((CELL_W - meta.width) / 2);
      const y = row * CELL_H + 5;
      composites.push({ input: thumbBuf, left: x, top: y });

      const label = 'id ' + d.id + (d.names.ru ? ': ' + d.names.ru : '');
      const labelSvg = `<svg width="${CELL_W}" height="40">
        <rect width="100%" height="100%" fill="white"/>
        <text x="50%" y="20" font-size="15" text-anchor="middle" fill="black" font-family="sans-serif">${label.replace(/&/g,'&amp;').slice(0,32)}</text>
      </svg>`;
      composites.push({ input: Buffer.from(labelSvg), left: col * CELL_W, top: row * CELL_H + IMG_H + 10 });
    }

    await sharp({ create: { width: sheetW, height: sheetH, channels: 3, background: { r: 255, g: 255, b: 255 } } })
      .composite(composites)
      .jpeg({ quality: 80 })
      .toFile(path.join(OUT_DIR, `dd-sheet-${String(s+1).padStart(2,'0')}.jpg`));
    console.log('sheet', s + 1, 'done', batch.length, 'images');
  }
})();
