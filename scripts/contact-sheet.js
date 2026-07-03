const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const DIR = process.argv[2];
const OUT_DIR = process.argv[3];
const PER_SHEET = 20; // 4 cols x 5 rows
const COLS = 4;
const CELL_W = 340;
const CELL_H = 300; // extra space for label
const IMG_H = 250;

function naturalSort(files) {
  return files.sort((a, b) => {
    const na = a.match(/\d+/g);
    const nb = b.match(/\d+/g);
    const numA = na ? parseInt(na[na.length-1]) : 0;
    const numB = nb ? parseInt(nb[nb.length-1]) : 0;
    if (numA !== numB) return numA - numB;
    return a.localeCompare(b);
  });
}

(async () => {
  const files = naturalSort(fs.readdirSync(DIR).filter(f => /\.(jpe?g|png)$/i.test(f)));
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  for (let s = 0; s < Math.ceil(files.length / PER_SHEET); s++) {
    const batch = files.slice(s * PER_SHEET, (s + 1) * PER_SHEET);
    const rows = Math.ceil(batch.length / COLS);
    const sheetW = COLS * CELL_W;
    const sheetH = rows * CELL_H;

    const composites = [];
    for (let i = 0; i < batch.length; i++) {
      const f = batch[i];
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const thumbBuf = await sharp(path.join(DIR, f))
        .resize(CELL_W - 20, IMG_H, { fit: 'inside' })
        .toBuffer();
      const meta = await sharp(thumbBuf).metadata();
      const x = col * CELL_W + Math.round((CELL_W - meta.width) / 2);
      const y = row * CELL_H + 5;
      composites.push({ input: thumbBuf, left: x, top: y });

      const labelSvg = `<svg width="${CELL_W}" height="40">
        <rect width="100%" height="100%" fill="white"/>
        <text x="50%" y="20" font-size="18" text-anchor="middle" fill="black" font-family="sans-serif">${f.replace(/\.(jpe?g|png)$/i,'')}</text>
      </svg>`;
      composites.push({ input: Buffer.from(labelSvg), left: col * CELL_W, top: row * CELL_H + IMG_H + 10 });
    }

    await sharp({ create: { width: sheetW, height: sheetH, channels: 3, background: { r: 255, g: 255, b: 255 } } })
      .composite(composites)
      .jpeg({ quality: 78 })
      .toFile(path.join(OUT_DIR, `sheet-${String(s+1).padStart(2,'0')}.jpg`));
    console.log('sheet', s + 1, 'done', batch.length, 'images');
  }
})();
