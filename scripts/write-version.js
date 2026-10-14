// Her build öncesi çalışır: sürüm kimliğini üretir ve hem istemci koduna
// (src/environments/build-version.ts) hem de yayınlanan public/version.json'a yazar.
// İstemci açılışta ve periyodik olarak version.json'u kendi gömülü sürümüyle karşılaştırır.
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.join(__dirname, '..');
const dev = process.argv.includes('--dev');

let version = 'dev';
if (!dev) {
  let sha = '';
  try {
    sha = execSync('git rev-parse --short HEAD', { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {}
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..*$/, '');
  version = sha ? `${stamp}-${sha}` : stamp;
}

const tsFile = path.join(root, 'src/environments/build-version.ts');
const jsonFile = path.join(root, 'public/version.json');

// Geliştirmede mevcut sürüm dosyası varsa ezme (yalnızca eksikse oluştur).
if (!dev || !fs.existsSync(tsFile)) {
  fs.writeFileSync(
    tsFile,
    `// Bu dosya scripts/write-version.js tarafından üretilir, elle düzenlemeyin.\nexport const BUILD_VERSION: string = '${version}';\n`
  );
  fs.writeFileSync(jsonFile, JSON.stringify({ version }) + '\n');
}
console.log(`[version] ${dev ? 'dev' : 'build'} sürümü: ${version}`);
