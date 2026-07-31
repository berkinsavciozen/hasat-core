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
// Bu script dosyanın İÇERİĞİNİ denetler, varlığını değil: (1) her satır
// `EXPO_PUBLIC_` ile başlamalı — başlamayan bir değişken derlemeye
// gömülmez ama yanlışlıkla dosyaya eklenmişse asıl sır burada sessizce
// commit'lenmiş olabilir; (2) `EXPO_PUBLIC_` prefix'i bile olsa
// service_role/SECRET/PRIVATE/TOKEN/PASSWORD kalıpları geçen bir isim
// (örn. yanlışlıkla `EXPO_PUBLIC_SERVICE_KEY`) prefix kontrolünü aşıp asıl
// bir sırrı pakete gömebilir — bu ayrıca yakalanır.
//
// Gerekçe: hasat-vault/Build/Shared-Architecture.md → ".env içerik bekçisi".
//
// Kullanım: node scripts/check-env-guard.mjs <hasat-mobile-repo-kökü>

import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const SECRET_PATTERNS = [/service_role/i, /SECRET/i, /PRIVATE/i, /TOKEN/i, /PASSWORD/i];

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

  if (!name.startsWith("EXPO_PUBLIC_")) {
    violations.push(`"${name}" — EXPO_PUBLIC_ prefix'i yok (pakete gömülmeyen bir değişken .env'de ne arıyor?)`);
    continue;
  }

  for (const pattern of SECRET_PATTERNS) {
    if (pattern.test(name)) {
      violations.push(
        `"${name}" — isimde "${pattern.source}" kalıbı var. EXPO_PUBLIC_ prefix'i bunu paketin İÇİNE gömer, sır bu yolla asla .env'ye yazılmaz.`,
      );
      break;
    }
  }
}

if (violations.length === 0) {
  console.log(`✅ .env içerik kontrolü geçti — ${lines.length} satırın tamamı EXPO_PUBLIC_ ve sır kalıbı taşımıyor.`);
  process.exit(0);
}

console.error(`❌ .env İÇERİK BEKÇİSİ İHLAL BULDU — ${envPath}`);
for (const v of violations) console.error(`   ${v}`);
console.error("");
console.error("Gerçek sırlar (service_role key, API token vb.) hiçbir zaman .env'ye yazılmaz —");
console.error("EAS Environment Variables'a konur (bkz. hasat-vault/Build/Shared-Architecture.md).");
process.exit(1);
