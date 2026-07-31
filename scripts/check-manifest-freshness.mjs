#!/usr/bin/env node
// hasat-core sürüm-gerisi (staleness) kontrolü.
//
// `check-drift.mjs`in cevaplamadığı soruyu cevaplar: "hedef kopya
// `hasat-core`'un KENDİ `core/.manifest`'iyle aynı sürümde mi?"
//
// Neden ayrı script: check-drift.mjs hedefin kendi manifest'ine karşı
// dosyaları doğruluyor (elle düzenleme var mı) — bu, hedef bayat bir sürümde
// TUTARLI kaldığında (bekleyen bir sync PR'ı merge edilmediğinde) yeşil
// yanar. Bu script iki manifest'i (hasat-core'un kendisi ↔ hedefteki kopya)
// birebir karşılaştırıp o kör noktayı kapatır.
//
// Bkz. hasat-vault/Build/Shared-Architecture.md → "Drift kontrolünün kör
// noktası" (M5 açık maddesiydi).
//
// Kullanım:
//   node scripts/check-manifest-freshness.mjs <hedef-core-klasörü>
//   node scripts/check-manifest-freshness.mjs ../hasat-d2c-marketplace/src/lib/core

import { existsSync, readFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const MANIFEST_NAME = ".manifest";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_MANIFEST = join(ROOT, "core", MANIFEST_NAME);
const target = resolve(process.argv[2] ?? "");

function fail(msg) {
  console.error(`❌ ${msg}`);
  process.exit(1);
}

if (!target) fail("Hedef klasör argümanı gerekli.");
if (!existsSync(SOURCE_MANIFEST)) fail(`hasat-core'un kendi manifest'i yok: ${SOURCE_MANIFEST}`);

const targetManifest = join(target, MANIFEST_NAME);
if (!existsSync(targetManifest)) fail(`Hedefte manifest yok: ${targetManifest}`);

const sourceContent = readFileSync(SOURCE_MANIFEST, "utf8").trim();
const targetContent = readFileSync(targetManifest, "utf8").trim();

if (sourceContent === targetContent) {
  console.log("✅ Sürüm gerisi yok — hedefin manifest'i hasat-core ile birebir aynı.");
  process.exit(0);
}

console.error(`❌ SÜRÜM GERİSİ TESPİT EDİLDİ — ${target}`);
console.error("   Hedefin src/lib/core/.manifest'i hasat-core'un core/.manifest'inden farklı.");
console.error("   Bu, bekleyen bir 'hasat-core sync' PR'ının merge edilmediği anlamına gelir —");
console.error("   web/mobil kopyası kendi içinde tutarlı ama canlı şemadan/koddan geride kalmış olabilir.");
console.error("");
console.error("   Kontrol: hedef repoda açık bir 'hasat-core sync → src/lib/core' PR'ı var mı? Varsa merge et.");
process.exit(1);
