#!/usr/bin/env node
// Web reposunda `@/integrations/supabase/types` (veya o klasör içinden göreli
// `./types`) import eden dosya var mı diye tarar.
//
// Neden burada (hasat-core'da) yaşıyor: web reposundaki ESLint kuralı
// (no-restricted-imports) aynı şeyi yakalıyor, ama Lovable lint çalıştırmadan
// commit edebilir. Bu script `drift-check.yml`'in günlük 06:00 UTC koşusunda
// web reposunun bağımsız bir kopyasına karşı çalışır — ESLint atlansa bile
// yakalar.
//
// Yakaladığı tek durum: `src/integrations/supabase/types.ts` Lovable
// tarafından yeniden üretilmiş bayat scaffold dosyasıdır (bkz. kural
// #105/#106, hasat-vault Build/Shared-Architecture.md). Dosyanın var olması
// sorun değil — sorun kodun ondan import etmesi.
//
// Kullanım:
//   node scripts/check-forbidden-imports.mjs <web-repo-kök-dizini>

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const IGNORED_DIRS = new Set(["node_modules", "dist", ".output", ".vinxi", ".git"]);
const FILE_EXTENSIONS = new Set([".ts", ".tsx"]);

const repoRoot = resolve(process.argv[2] ?? ".");
const srcDir = join(repoRoot, "src");

function fail(msg) {
  console.error(`❌ ${msg}`);
  process.exit(1);
}

if (!existsSync(srcDir)) fail(`src/ klasörü bulunamadı: ${srcDir}`);

function listFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    if (IGNORED_DIRS.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      out.push(...listFiles(full));
    } else if (FILE_EXTENSIONS.has(name.slice(name.lastIndexOf(".")))) {
      out.push(full);
    }
  }
  return out;
}

// Alias import — repo'nun herhangi bir yerinden, `@/integrations/supabase/types`.
const ALIAS_IMPORT = /from\s+["']@\/integrations\/supabase\/types(?:\.(?:ts|tsx))?["']/;
// Göreli import — sadece `src/integrations/supabase/` klasörünün kendi
// içinden `./types` (bu klasörün dışında `./types` başka bir dosyaya
// işaret edebilir, o yüzden konum şartı var).
const RELATIVE_IMPORT = /from\s+["']\.\/types(?:\.(?:ts|tsx|js))?["']/;
const RELATIVE_IMPORT_SCOPE = join(srcDir, "integrations", "supabase") + "/";

const violations = [];

for (const file of listFiles(srcDir)) {
  const content = readFileSync(file, "utf8");
  if (ALIAS_IMPORT.test(content)) {
    violations.push({ file: relative(repoRoot, file), pattern: "@/integrations/supabase/types" });
  }
  if (file.startsWith(RELATIVE_IMPORT_SCOPE) && RELATIVE_IMPORT.test(content)) {
    violations.push({ file: relative(repoRoot, file), pattern: "./types (src/integrations/supabase/ içinden)" });
  }
}

if (violations.length === 0) {
  console.log("✅ Yasaklı import yok — hiçbir dosya bayat Supabase types.ts'ten import etmiyor.");
  process.exit(0);
}

console.error(`❌ YASAKLI IMPORT TESPİT EDİLDİ — ${repoRoot}`);
for (const v of violations) console.error(`   ${v.file}  →  ${v.pattern}`);
console.error("");
console.error("Kural #105/#106: DB tipleri için @/lib/core/db/types kullanılmalı.");
console.error("src/integrations/supabase/types.ts Lovable'ın yeniden ürettiği bayat scaffold'dur — dosyayı silme, sadece import'u düzelt.");
process.exit(1);
