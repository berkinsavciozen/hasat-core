#!/usr/bin/env node
// hasat-core manifest üreteci.
//
// `core/` altındaki her dosyanın sha256'sını `core/.manifest` dosyasına yazar.
// Subtree ile inen kopyada bu dosya `src/lib/core/.manifest` olarak durur ve
// sapma kontrolü (scripts/check-drift.mjs) bunun üzerinden çalışır.
//
// Kullanım: node scripts/gen-manifest.mjs

import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CORE = join(ROOT, "core");
const MANIFEST_NAME = ".manifest";

export function listFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    if (name === MANIFEST_NAME) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...listFiles(full));
    else out.push(full);
  }
  return out;
}

export function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

export function buildManifest(coreDir) {
  const entries = listFiles(coreDir)
    .map((f) => [relative(coreDir, f).split("\\").join("/"), sha256(f)])
    .sort((a, b) => a[0].localeCompare(b[0]));

  const lines = [
    "# hasat-core sapma manifesti — sha256(dosya içeriği)",
    "# Elle düzenlenmez. hasat-core'da `npm run manifest` ile üretilir.",
    "# Kontrol: hasat-core'da `npm run drift -- <bu klasörün yolu>`",
    ...entries.map(([rel, hash]) => `${hash}  ${rel}`),
  ];
  return lines.join("\n") + "\n";
}

const manifest = buildManifest(CORE);
writeFileSync(join(CORE, MANIFEST_NAME), manifest);
const count = manifest.split("\n").filter((l) => l && !l.startsWith("#")).length;
console.log(`✅ core/${MANIFEST_NAME} yazıldı — ${count} dosya.`);
