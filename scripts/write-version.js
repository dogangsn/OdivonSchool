// Her build öncesi çalışır: sürüm bilgisini üretir ve hem istemci koduna
// (src/environments/build-version.ts) hem de yayınlanan public/version.json'a yazar.
// - version: kullanıcıya gösterilen sürüm, her committe artar (1.0.<commit sayısı>)
// - build:   karşılaştırma için benzersiz kimlik (zaman damgası + commit)
// İstemci açılışta ve periyodik olarak version.json'u kendi gömülü kimliğiyle karşılaştırır.
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.join(__dirname, '..');
const dev = process.argv.includes('--dev');
const MAJOR_MINOR = '1.0';

function git(cmd) {
  try {
    return execSync(`git ${cmd}`, { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return '';
  }
}

let version = 'dev';
let build = 'dev';
if (!dev) {
  const count = git('rev-list --count HEAD') || '0';
  const sha = git('rev-parse --short HEAD');
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..*$/, '');
  version = `${MAJOR_MINOR}.${count}`;
  build = sha ? `${stamp}-${sha}` : stamp;
}

const tsFile = path.join(root, 'src/environments/build-version.ts');
const jsonFile = path.join(root, 'public/version.json');

// Geliştirmede mevcut sürüm dosyası varsa ezme (yalnızca eksikse oluştur).
if (!dev || !fs.existsSync(tsFile) || !fs.readFileSync(tsFile, 'utf8').includes('BUILD_ID')) {
  fs.writeFileSync(
    tsFile,
    '// Bu dosya scripts/write-version.js tarafından üretilir, elle düzenlemeyin.\n' +
      `export const APP_VERSION: string = '${version}';\n` +
      `export const BUILD_ID: string = '${build}';\n`
  );
  fs.writeFileSync(jsonFile, JSON.stringify({ version, build }) + '\n');
}
console.log(`[version] ${dev ? 'dev' : `v${version} (${build})`}`);
