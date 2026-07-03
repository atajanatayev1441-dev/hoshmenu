const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'реальное меню');
const OUT_DIRS = [
  path.join(__dirname, '..', 'dishes'),
  path.join(__dirname, '..', 'www', 'dishes'),
];
const MAX_W = 1200;
const QUALITY = 78;

const RENAME = {
  'photo-2 (2).jpg': 'photo-2b.jpg',
  'photo-3 (2).jpg': 'photo-3b.jpg',
  'photo-4 (2).jpg': 'photo-4b.jpg',
};

for (const dir of OUT_DIRS) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
}

(async () => {
  const files = fs.readdirSync(SRC, { withFileTypes: true })
    .filter(e => e.isFile() && /\.(jpe?g|png)$/i.test(e.name))
    .map(e => e.name);
  for (const f of files) {
    const srcPath = path.join(SRC, f);
    const outName = RENAME[f] || f;
    const buf = await sharp(srcPath)
      .resize(MAX_W, MAX_W, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: QUALITY, mozjpeg: true })
      .toBuffer();
    for (const dir of OUT_DIRS) {
      fs.writeFileSync(path.join(dir, outName), buf);
    }
    console.log(outName, (buf.length / 1024).toFixed(0) + 'KB');
  }
  console.log('done', files.length, 'files');
})();
