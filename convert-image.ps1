param(
  [string]$Root = ".\public\uploads",
  [int]$MaxSize = 1600
)

$script = @'
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const root = path.resolve(process.argv[2]);
const maxSize = Number(process.argv[3] || 1600);
const extensions = new Set(['.jpg', '.jpeg', '.png', '.webp']);

async function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(full, out);
      continue;
    }

    if (extensions.has(path.extname(entry.name).toLowerCase())) {
      out.push(full);
    }
  }

  return out;
}

async function optimize(file) {
  const image = sharp(file, { failOn: 'none' });
  const meta = await image.metadata();
  if (!meta.width || !meta.height) {
    return null;
  }

  const resized = image.rotate().resize({
    width: maxSize,
    height: maxSize,
    fit: 'inside',
    withoutEnlargement: true
  });

  const ext = path.extname(file).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') {
    await resized.jpeg({ quality: 82, mozjpeg: true }).toFile(file + '.tmp');
  } else if (ext === '.png') {
    await resized.png({ compressionLevel: 9, adaptiveFiltering: true }).toFile(file + '.tmp');
  } else if (ext === '.webp') {
    await resized.webp({ quality: 82 }).toFile(file + '.tmp');
  } else {
    return null;
  }

  fs.renameSync(file + '.tmp', file);
  return {
    file,
    before: `${meta.width}x${meta.height}`,
    after: await sharp(file).metadata()
  };
}

(async () => {
  const files = await walk(root);
  for (const file of files) {
    const result = await optimize(file);
    if (!result) {
      continue;
    }

    console.log(`${path.relative(root, result.file)}\t${result.before}\t${result.after.width}x${result.after.height}\t${fs.statSync(result.file).size}`);
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
'@

$script | node - $Root $MaxSize
