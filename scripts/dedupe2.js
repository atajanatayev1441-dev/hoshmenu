const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const DIR = process.argv[2];
const files = fs.readdirSync(DIR).filter(f => /\.(jpe?g|png)$/i.test(f));

const SIZE = 24;

async function thumb(file) {
  const buf = await sharp(file)
    .resize(SIZE, SIZE, { fit: 'fill' })
    .removeAlpha()
    .raw()
    .toBuffer();
  return buf; // SIZE*SIZE*3 bytes
}

function mse(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return sum / a.length;
}

(async () => {
  const thumbs = {};
  for (const f of files) {
    thumbs[f] = await thumb(path.join(DIR, f));
  }

  // print MSE for known calibration pairs
  const calib = [['photo-23.jpg','photo-24.jpg'], ['photo-23.jpg','photo-33.jpg'], ['photo-33.jpg','photo-34.jpg']];
  for (const [a,b] of calib) {
    if (thumbs[a] && thumbs[b]) console.log('calib', a, b, mse(thumbs[a], thumbs[b]).toFixed(2));
  }

  const parent = {};
  files.forEach(f => parent[f] = f);
  function find(x){ while(parent[x]!==x){ parent[x]=parent[parent[x]]; x=parent[x];} return x; }
  function union(a,b){ const ra=find(a), rb=find(b); if(ra!==rb) parent[ra]=rb; }

  const THRESHOLD = parseFloat(process.argv[3] || '150');
  const pairs = [];
  for (let i = 0; i < files.length; i++) {
    for (let j = i + 1; j < files.length; j++) {
      const d = mse(thumbs[files[i]], thumbs[files[j]]);
      if (d <= THRESHOLD) { union(files[i], files[j]); pairs.push([files[i], files[j], d]); }
    }
  }

  const clusters = {};
  files.forEach(f => {
    const r = find(f);
    clusters[r] = clusters[r] || [];
    clusters[r].push(f);
  });

  const clusterList = Object.values(clusters).sort((a, b) => {
    const na = parseInt((a[0].match(/\d+/) || [0])[0]);
    const nb = parseInt((b[0].match(/\d+/) || [0])[0]);
    return na - nb;
  });

  fs.writeFileSync(
    path.join(__dirname, 'dedupe-result.json'),
    JSON.stringify(clusterList, null, 2)
  );

  console.log('THRESHOLD', THRESHOLD);
  console.log('Total files:', files.length);
  console.log('Total clusters (unique dishes):', clusterList.length);
  console.log('Clusters with duplicates:', clusterList.filter(c => c.length > 1).length);
  clusterList.forEach(c => {
    if (c.length > 1) console.log(c.join('  <->  '));
  });
})();
