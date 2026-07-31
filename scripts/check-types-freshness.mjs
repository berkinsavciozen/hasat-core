#!/usr/bin/env node
// hasat-core DB tip tazeliği kontrolü.
//
// Bu script, drift/freshness scriptlerinin kapatamadığı üçüncü kör noktayı
// kapatır: `core/db/types.ts` **hedef repolarla** tutarlı olabilir (drift
// yeşil), ama canlı Supabase şemasından geride kalmış olabilir — çünkü
// `supabase gen types` hiç kimse tarafından yeniden çalıştırılmamıştır.
//
// Bkz. hasat-vault/TODO.md → kural #111 (2026-07-30'da eklendi):
// M4-c'de `recipes.rest_minutes` eklendi ama tip üretimi yenilenmedi;
// bayat tipler subtree ile hem web'e hem mobile indi, drift check yeşil
// kaldı çünkü üç kopya tutarlı biçimde yanlıştı.
//
// Yakaladığı soru: "commit'lenmiş core/db/types.ts, `supabase gen types
// typescript --project-id efuqpiaavrzimvstpdpm`'in ŞU AN üreteceği çıktıyla
// aynı mı?"
//
// Gerekli secret: SUPABASE_ACCESS_TOKEN (bkz. README.md → "Gereken secret").
//
// Kullanım: node scripts/check-types-freshness.mjs <live-types-dosyası>
//   (live dosya CI'da `supabase gen types typescript` çıktısı olarak
//   önceden üretilip bu scripte argüman olarak verilir)

import { existsSync, readFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const COMMITTED_PATH = join(ROOT, "core", "db", "types.ts");

function fail(msg) {
  console.error(`❌ ${msg}`);
  process.exit(1);
}

const liveArg = process.argv[2];
if (!liveArg) fail("Argüman gerekli: canlı `supabase gen types` çıktısının yolu.");
const livePath = resolve(liveArg);
if (!existsSync(livePath)) fail(`Canlı tip dosyası bulunamadı: ${livePath}`);

// Committed dosyanın başındaki elle eklenen "BU DOSYAYI BURADA DÜZENLEME"
// başlığı `supabase gen types` çıktısının bir parçası değil — karşılaştırma
// öncesi ayıklanır. `export type Json` her zaman gerçek üretilmiş içeriğin
// ilk satırıdır.
function stripHeader(content) {
  const lines = content.split("\n");
  const jsonIdx = lines.findIndex((l) => l.startsWith("export type Json"));
  if (jsonIdx === -1) return content.trim();
  return lines.slice(jsonIdx).join("\n").trim();
}

const committed = stripHeader(readFileSync(COMMITTED_PATH, "utf8"));
const live = stripHeader(readFileSync(livePath, "utf8"));

if (committed === live) {
  console.log("✅ Tip tazeliği doğrulandı — core/db/types.ts canlı şemayla birebir aynı.");
  process.exit(0);
}

console.error("❌ BAYAT TİPLER TESPİT EDİLDİ — core/db/types.ts canlı şemadan geri düşmüş.");
console.error("");
console.error("   `supabase gen types typescript --project-id efuqpiaavrzimvstpdpm` çıktısı");
console.error("   commit'lenmiş core/db/types.ts ile farklı. Bu, bir şema değişikliğinden");
console.error("   (migration/kolon/view eklenmesi) sonra tip üretiminin yenilenmediği anlamına gelir.");
console.error("");
console.error("   Düzeltme:");
console.error("   supabase gen types typescript --project-id efuqpiaavrzimvstpdpm > core/db/types.ts");
console.error("   (başlık yorumunu geri ekle, tarihi güncelle) → npm run manifest → commit + push");
console.error("");
console.error("   Kural #111 (hasat-vault/TODO.md): DB↔core tutarlılığı, core↔hedef");
console.error("   drift kontrolünden BAĞIMSIZ bir garanti gerektirir — bu script o garantidir.");
process.exit(1);
