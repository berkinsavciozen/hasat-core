#!/usr/bin/env node
// hasat-mobile `.env` içerik bekçisi.
//
// `hasat-mobile/.env` public repoda takip ediliyor ve takip edilmeye devam
// edecek — silinirse/gitignore'lanırsa her klonda uygulama Supabase URL/anon
// key olmadan açılamaz hale gelir. İçindeki iki değer (Supabase URL + anon
// publishable key) tasarım gereği public: `EXPO_PUBLIC_` prefix'i Expo'da
// bu değerlerin derleme sırasında uygulama paketine gömüleceği anlamına
// geliyor — zaten istemci tarafında görünür olacaklar.
//
// BEYAZ LİSTE (P23-M5-b'de kara listeden çevrildi): `.env` yalnızca aşağıdaki
// bilinen değişken adlarını içerebilir. Önceki sürüm bir kara liste
// kullanıyordu (`EXPO_PUBLIC_` prefix'i + service_role/SECRET/PRIVATE/TOKEN/
// PASSWORD kalıpları reddedilir) — akıllı bir isimlendirmeyle atlatılabilirdi
// (örn. `EXPO_PUBLIC_APIKEY` gibi kalıpta geçmeyen bir kelime seçmek). Beyaz
// liste bunu kapatıyor: listede olmayan HER isim, kalıp taşısın taşımasın,
// reddedilir. Sonucu: yeni bir meşru değişken eklemek artık bu dosyada
// bilinçli bir commit'i (allowlist'e ekleme) gerektiriyor — bu commit kendi
// başına bir inceleme noktası.
//
// Gerekçe: hasat-vault/Build/Shared-Architecture.md → ".env içerik bekçisi".
//
// Kullanım: node scripts/check-env-guard.mjs <hasat-mobile-repo-kökü>

import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ALLOWED_NAMES = new Set(["EXPO_PUBLIC_SUPABASE_URL", "EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY"]);

function fail(msg) {
  console.error(`❌ ${msg}`);
  process.exit(1);
}

const repoRoot = resolve(process.argv[2] ?? "");
if (!repoRoot) fail("Argüman gerekli: hasat-mobile repo kökü.");

const envPath = join(repoRoot, ".env");
if (!existsSync(envPath)) fail(`.env bulunamadı: ${envPath}`);

const lines = readFileSync(envPath, "utf8")
  .split("\n")
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith("#"));

const violations = [];

for (const line of lines) {
  const eqIdx = line.indexOf("=");
  const name = eqIdx === -1 ? line : line.slice(0, eqIdx);

  if (!ALLOWED_NAMES.has(name)) {
    violations.push(
      `"${name}" — allowlist'te değil. İzin verilen adlar: ${Array.from(ALLOWED_NAMES).join(", ")}.`,
    );
  }
}

if (violations.length === 0) {
  console.log(`✅ .env içerik kontrolü geçti — ${lines.length} satırın tamamı allowlist'te.`);
  process.exit(0);
}

console.error(`❌ .env İÇERİK BEKÇİSİ İHLAL BULDU — ${envPath}`);
for (const v of violations) console.error(`   ${v}`);
console.error("");
console.error("Yeni bir meşru EXPO_PUBLIC_ değişkeni eklemek gerekiyorsa, bu script'teki");
console.error("ALLOWED_NAMES listesine bilinçli bir commit ile eklenmeli (bkz. dosya başlığı).");
console.error("Gerçek sırlar (service_role key, API token vb.) hiçbir zaman .env'ye yazılmaz —");
console.error("EAS Environment Variables'a konur (bkz. hasat-vault/Build/Shared-Architecture.md).");
process.exit(1);
