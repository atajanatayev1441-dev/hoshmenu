const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const DIR = process.argv[2];
const files = fs.readdirSync(DIR).filter(f => /\.(jpe?g|png)$/i.test(f));

// dHash: 9x8 grayscale, compare adjacent pixels horizontally -> 64 bit hash
async function dhash(file) {
  const buf = await sharp(file)
    .grayscale()
    .resize(9, 8, { fit: 'fill' })
    .raw()
    .toBuffer();
  let bits = '';
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const i = row * 9 + col;
      bits += buf[i] < buf[i + 1] ? '1' : '0';
    }
  }
  return bits;
}

function hamming(a, b) {
  let d = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d++;
  return d;
}

(async () => {
  const hashes = {};
  for (const f of files) {
    hashes[f] = await dhash(path.join(DIR, f));
  }

  // union-find clustering
  const parent = {};
  files.forEach(f => parent[f] = f);
  function find(x){ while(parent[x]!==x){ parent[x]=parent[parent[x]]; x=parent[x];} return x; }
  function union(a,b){ const ra=find(a), rb=find(b); if(ra!==rb) parent[ra]=rb; }

  const THRESHOLD = 10; // out of 64 bits
  for (let i = 0; i < files.length; i++) {
    for (let j = i + 1; j < files.length; j++) {
      const d = hamming(hashes[files[i]], hashes[files[j]]);
      if (d <= THRESHOLD) union(files[i], files[j]);
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

  console.log('Total files:', files.length);
  console.log('Total clusters (unique dishes):', clusterList.length);
  console.log('Clusters with duplicates:', clusterList.filter(c => c.length > 1).length);
  clusterList.forEach(c => {
    if (c.length > 1) console.log(c.join('  <->  '));
  });
})();
