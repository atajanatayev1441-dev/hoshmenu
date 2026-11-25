// Подпись APK (APK Signature Scheme v2, Android 7+) без Java. Ключ не покидает ПК и не пишется на диск.
//   node scripts/sign-apk.js sign <неподписанный.apk> <готовый.apk>
//   node scripts/sign-apk.js verify <файл.apk>
const fs = require('fs'), path = require('path'), crypto = require('crypto'), { execFileSync } = require('child_process');
const V2 = 0x7109871a, PAD = 0x42726577, MAGIC = Buffer.from('APK Sig Block 42'), RSA_SHA256 = 0x0103, CHUNK = 1 << 20;
const sha = b => crypto.createHash('sha256').update(b).digest();
const u32 = n => { const b = Buffer.alloc(4); b.writeUInt32LE(n >>> 0); return b; };
const u64 = n => { const b = Buffer.alloc(8); b.writeBigUInt64LE(BigInt(n)); return b; };
const lp = b => Buffer.concat([u32(b.length), b]);
const cat = (...a) => Buffer.concat(a);

function layout(buf) {
  let e = buf.length - 22;
  while (e >= 0 && !(buf.readUInt32LE(e) === 0x06054b50 && e + 22 + buf.readUInt16LE(e + 20) === buf.length)) e--;
  if (e < 0) throw new Error('EOCD not found');
  const cd = buf.readUInt32LE(e + 16), cdSize = buf.readUInt32LE(e + 12);
  if (cd + cdSize !== e) throw new Error('unexpected data between central directory and EOCD');
  let blockStart = cd, pairs = [];
  if (buf.subarray(cd - 16, cd).equals(MAGIC)) {
    const size = Number(buf.readBigUInt64LE(cd - 24));
    blockStart = cd - size - 8;
    if (Number(buf.readBigUInt64LE(blockStart)) !== size) throw new Error('bad signing block');
    for (let p = blockStart + 8; p < cd - 24;) {
      const len = Number(buf.readBigUInt64LE(p));
      pairs.push([buf.readUInt32LE(p + 8), buf.subarray(p + 12, p + 8 + len)]);
      p += 8 + len;
    }
  }
  return { e, cd, blockStart, pairs };
}
function contentDigest(entries, cdir, eocd, newCdOffset, alg = 'sha256') {
  const h = b => crypto.createHash(alg).update(b).digest();
  const end = Buffer.from(eocd); end.writeUInt32LE(newCdOffset, 16);
  const ds = [];
  for (const sec of [entries, cdir, end]) for (let p = 0; p < sec.length; p += CHUNK) {
    const c = sec.subarray(p, p + CHUNK);
    ds.push(h(cat(Buffer.from([0xa5]), u32(c.length), c)));
  }
  return h(cat(Buffer.from([0x5a]), u32(ds.length), ...ds));
}
function seq(b) { const out = []; for (let p = 0; p < b.length;) { const n = b.readUInt32LE(p); if (p + 4 + n > b.length) throw new Error('bad length'); out.push(b.subarray(p + 4, p + 4 + n)); p += 4 + n; } return out; }

function verify(file) {
  const buf = fs.readFileSync(file), L = layout(buf), v2 = L.pairs.find(p => p[0] === V2);
  console.log(path.basename(file), 'blocks:', L.pairs.map(p => '0x' + p[0].toString(16)).join(' ') || 'none');
  if (!v2) throw new Error('no v2 signature');
  const [signers] = seq(v2[1]);
  const all = seq(signers);
  if (!all.length) throw new Error('no signers');
  let fp;
  for (const s of all) {
    const [signed, sigs, pub] = seq(s), key = crypto.createPublicKey({ key: pub, format: 'der', type: 'spki' });
    const ok = seq(sigs).filter(x => [0x0103, 0x0104].includes(x.readUInt32LE(0)));
    if (!ok.length) throw new Error('no RSA PKCS1 signature');
    for (const x of ok) if (!crypto.verify(x.readUInt32LE(0) === 0x0103 ? 'sha256' : 'sha512', signed, key, seq(x.subarray(4))[0])) throw new Error('SIGNATURE MISMATCH');
    const [digs, certs] = seq(signed), cert = new crypto.X509Certificate(seq(certs)[0]);
    if (!cert.publicKey.export({ format: 'der', type: 'spki' }).equals(pub)) throw new Error('CERT/KEY MISMATCH');
    for (const d of seq(digs)) {
      const id = d.readUInt32LE(0); if (![0x0103, 0x0104].includes(id)) continue;
      const want = contentDigest(buf.subarray(0, L.blockStart), buf.subarray(L.cd, L.e), buf.subarray(L.e), L.blockStart, id === 0x0103 ? 'sha256' : 'sha512');
      if (!want.equals(seq(d.subarray(4))[0])) throw new Error('DIGEST MISMATCH');
    }
    fp = sha(cert.raw).toString('hex');
  }
  console.log('VERIFIED, cert sha256', fp);
  return fp;
}
function loadKey() {
  const root = path.join(__dirname, '..', 'android-app'), props = {};
  fs.readFileSync(path.join(root, 'android', 'keystore.properties'), 'utf8').split(/\r?\n/).forEach(l => { const i = l.indexOf('='); if (i > 0) props[l.slice(0, i).trim()] = l.slice(i + 1).trim(); });
  const ossl = ['C:/Program Files/Git/mingw64/bin/openssl.exe', 'C:/Program Files/Git/usr/bin/openssl.exe'].find(f => fs.existsSync(f)) || 'openssl';
  const pem = execFileSync(ossl, ['pkcs12', '-in', path.join(root, 'hoslounge-release.keystore'), '-nodes', '-passin', 'env:HS_KS'], { env: { ...process.env, HS_KS: props.storePassword }, stdio: ['ignore', 'pipe', 'pipe'] }).toString();
  const key = crypto.createPrivateKey(pem.match(/-----BEGIN PRIVATE KEY-----[\s\S]+?-----END PRIVATE KEY-----/)[0]);
  if (key.asymmetricKeyType !== 'rsa') throw new Error('expected RSA key');
  const cert = pem.match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g).map(c => new crypto.X509Certificate(c)).find(c => c.checkPrivateKey(key));
  if (!cert) throw new Error('no certificate for key');
  return { key, cert };
}
function sign(src, dst) {
  const buf = fs.readFileSync(src), L = layout(buf), { key, cert } = loadKey();
  const entries = buf.subarray(0, L.blockStart), cdir = buf.subarray(L.cd, L.e), eocd = Buffer.from(buf.subarray(L.e));
  const digest = contentDigest(entries, cdir, eocd, entries.length);
  const signed = cat(lp(lp(cat(u32(RSA_SHA256), lp(digest)))), lp(lp(cert.raw)), lp(Buffer.alloc(0)));
  const sig = crypto.sign('sha256', signed, key);
  const signer = cat(lp(signed), lp(lp(cat(u32(RSA_SHA256), lp(sig)))), lp(cert.publicKey.export({ format: 'der', type: 'spki' })));
  const value = lp(lp(signer));
  const pair = (id, v) => cat(u64(4 + v.length), u32(id), v);
  let body = pair(V2, value);
  // блок кратен 4096, чтобы не сбить выравнивание
  const pad = (4096 - (8 + body.length + 12 + 24) % 4096) % 4096;
  body = cat(body, pair(PAD, Buffer.alloc(pad)));
  const size = u64(body.length + 24), block = cat(size, body, size, MAGIC);
  eocd.writeUInt32LE(entries.length + block.length, 16);
  fs.writeFileSync(dst, cat(entries, block, cdir, eocd));
  verify(dst);
}
const [, , cmd, a, b] = process.argv;
if (cmd === 'sign' && a && b) sign(a, b); else if (cmd === 'verify' && a) verify(a); else { console.error('usage: sign <in> <out> | verify <apk>'); process.exit(1); }
