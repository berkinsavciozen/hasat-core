#!/usr/bin/env node
// hasat-core sapma (drift) kontrolü.
//
// Bir hedef klasördeki core dosyalarını, o klasördeki `.manifest` dosyasında
// yazan sha256 değerleriyle karşılaştırır. Fark varsa exit code 1 ile çıkar.
//
// Kullanım:
//   node scripts/check-drift.mjs                        # hasat-core'un kendi core/ klasörü
//   node scripts/check-drift.mjs ../web/src/lib/core    # subtree ile inmiş kopya
//
// Yakaladığı üç durum:
//   1. DEĞİŞTİRİLMİŞ — dosya hedefte elle düzenlenmiş (kural #105 ihlali)
//   2. EKSİK        — core dosyası hedefte silinmiş
//   3. FAZLA        — hedefte manifestte olmayan bir dosya var

import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const MANIFEST_NAME = ".manifest";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const target = resolve(process.argv[2] ?? join(ROOT, "core"));

function listFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    if (name === MANIFEST_NAME) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...listFiles(full));
    else out.push(full);
  }
  return out;
}

const sha256 = (p) => createHash("sha256").update(readFileSync(p)).digest("hex");

function fail(msg) {
  console.error(`❌ ${msg}`);
  process.exit(1);
}

if (!existsSync(target)) fail(`Hedef klasör yok: ${target}`);
const manifestPath = join(target, MANIFEST_NAME);
if (!existsSync(manifestPath)) fail(`Manifest bulunamadı: ${manifestPath}`);

const expected = new Map();
for (const line of readFileSync(manifestPath, "utf8").split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const [hash, ...rest] = trimmed.split(/\s+/);
  expected.set(rest.join(" "), hash);
}

const actual = new Map(
  listFiles(target).map((f) => [relative(target, f).split("\\").join("/"), sha256(f)]),
);

const modified = [];
const missing = [];
const extra = [];

for (const [rel, hash] of expected) {
  if (!actual.has(rel)) missing.push(rel);
  else if (actual.get(rel) !== hash) modified.push(rel);
}
for (const rel of actual.keys()) if (!expected.has(rel)) extra.push(rel);

const problems = modified.length + missing.length + extra.length;

if (problems === 0) {
  console.log(`✅ Sapma yok — ${expected.size} core dosyası manifest ile birebir aynı.`);
  console.log(`   Hedef: ${target}`);
  process.exit(0);
}

console.error(`❌ SAPMA TESPİT EDİLDİ — ${target}`);
for (const rel of modified) console.error(`   DEĞİŞTİRİLMİŞ  ${rel}`);
for (const rel of missing) console.error(`   EKSİK          ${rel}`);
for (const rel of extra) console.error(`   FAZLA          ${rel}`);
console.error("");
console.error("Kural #105: core dosyaları hedef repoda düzenlenmez.");
console.error("Değişiklik hasat-core'da yapılır, subtree ile iner.");
process.exit(1);
