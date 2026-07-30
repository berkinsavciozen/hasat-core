# hasat-core

Hasat'ın **paylaşılan TypeScript çekirdeği**. Web (`hasat-d2c-marketplace`) ve
mobil (`hasat-mobile`, **M5-a'da açıldı**) uygulamalarının ikisinin de ihtiyaç
duyduğu, **React'e ve platforma bağımsız** kod burada yaşar.

> Onaylanan mimari: `hasat-vault/Build/Shared-Architecture.md`
> Kurallar: `hasat-vault/TODO.md` → #105 (core dosyaları düzenlenmez), #106 (iki
> client'ın da ihtiyaç duyduğu mantık DB'ye)

---

## Amaç

Aynı mantığın iki yerde yaşaması bu projede **iki kez** sessiz arızaya yol açtı
(P20 ve P24 — `dispatch_sms` ↔ `send-sms` sapması). İkinci bir client eklemek bu
riski ikiye katlıyor. Bu repo, DB'ye taşınamayan paylaşılan parçanın **tek
kaynağı** olarak o riski kapatır.

**Bu repo bir kütüphane değildir:**

- **Build step yok** — sadece TypeScript kaynak dosyaları
- **Publish yok** — npm'e çıkmaz, paket olarak kurulmaz
- Tüketici uygulamalar dosyaları **kendi TypeScript derlemelerine dahil eder**

---

## Kural: buradan iki repoya `git subtree` ile iner

```
hasat-core/core/
   │
   ├── git subtree ──►  hasat-d2c-marketplace : src/lib/core/
   └── git subtree ──►  hasat-mobile          : src/lib/core/   ✅ M5-a'da bağlandı
```

- **`git subtree`, submodule değil.** Lovable'ın build'i submodule init etmez;
  subtree düz dosya olarak iner ve hiçbir ek adım gerektirmez.
- **Web reposu monorepo/pnpm workspace'e ÇEVRİLMEZ.** `main` branch'i Lovable'ın
  sync bot'u (`gpt-engineer-app[bot]`) tarafından yönetiliyor; workspace yapısı
  Lovable'ın build'ini kırma riski taşır. Hedef repolara yalnızca **düz dosya**
  eklenir.
- **Hedef repoda core dosyaları düzenlenmez** (kural #105). Her dosyanın başında
  şu işaret vardır:

  ```ts
  // hasat-core — BU DOSYAYI BURADA DÜZENLEME. Değişiklik hasat-core reposunda yapılır.
  ```

- Hedef repodaki `src/lib/core/.manifest` her core dosyasının sha256'sını tutar;
  sapma saniyeler içinde tespit edilir.

### Değişiklik akışı

1. Değişiklik **burada** yapılır (`core/` altında).
2. `npm run manifest` → `core/.manifest` güncellenir.
3. `npm run drift` yeşil olmalı.
4. `main`'e merge → GitHub Action web reposuna PR açar.
5. PR merge edilir; `src/lib/core/` ve `.manifest` birlikte iner.

---

## İçerik

| Dosya | Ne |
|---|---|
| `core/db/types.ts` | `supabase gen types typescript` çıktısı (proje `efuqpiaavrzimvstpdpm`) |
| `core/design/tokens.ts` | Marka renkleri, semantik renkler, radius ölçeği, tipografi, spacing |
| `core/units.ts` | `convertQuantity()` — g↔kg dönüşümü (P21-A) |
| `core/supabase/client.ts` | **M5-a'da eklendi.** `createHasatSupabaseClient()` — storage adaptörü parametre alan paylaşılan Supabase client factory'si (web: `localStorage`, mobil: `expo-secure-store` tabanlı adapter) |
| `core/index.ts` | Barrel (DB tipleri hariç — 2.700 satırlık tip grafiği her import'a girmesin) |

### M5-a'da taşınanlar

- ✅ **Supabase client factory + storage adapter parametresi** — web'in davranışı
  değişmeden (bkz. `hasat-d2c-marketplace` PR: `refactor(supabase): client
  kurulumunu paylaşılan hasat-core factory'sine taşı`).

### Hâlâ M5-b/M6'ya bırakılanlar

- **TanStack Query hook'ları** (`useListings()`, `useRecipes()` …) — mobil
  tarafında `@tanstack/react-query` kuruldu (M5-a), ama ortak hook'lar henüz
  core'a taşınmadı.
- **Sorgu fonksiyonları** (`fetchListings()`, `fetchRecipe()` …)

Ayrıca taşınmadı (aday, ilk turu küçük tutmak için ertelendi):

- `src/lib/hasat/format.ts` — saf ve React'e bağımsız, ama web'de **33 dosya**
  import ediyor. Taşınması Lovable'ın dokunduğu 33 dosyada import değişikliği
  demek; lansman öncesi bu kadar geniş bir diff'in getirisi yok.
- `src/lib/hasat/coverage.ts`, `src/lib/hasat/offer-status.ts` — saf, ama
  `crop-config`/`types` üzerinden bir tip grafiği sürüklüyorlar; `offer-status.ts`
  ayrıca CSS değişkenlerine (design token) bağlı. Önce token bağlantısı
  netleşmeli.

---

## Komutlar

```bash
npm run manifest             # core/.manifest üret
npm run drift                # kendi core/ klasörünü manifest'e karşı doğrula
npm run drift -- ../hasat-d2c-marketplace/src/lib/core   # inmiş kopyayı doğrula (elle düzenleme)
npm run drift:freshness -- ../hasat-d2c-marketplace/src/lib/core   # sürüm-gerisi mi? (M5-a)
npm run typecheck            # tsc --noEmit (bağımsız tip kontrolü)
```

`npm run drift` üç durumu yakalar: **DEĞİŞTİRİLMİŞ**, **EKSİK**, **FAZLA**.
`npm run drift:freshness` hedefin manifest'inin `core/.manifest` ile birebir
aynı olup olmadığını karşılaştırır (**SÜRÜM GERİSİ**). İkisi de fark varsa
exit code 1 döner.

---

## GitHub Action

`.github/workflows/sync-to-web.yml` — `main`'e `core/**` altında bir değişiklik
girdiğinde **iki hedefe birden** (matrix: `hasat-d2c-marketplace` +
`hasat-mobile`) paralel PR açar. **M5-a'da ikinci hedef eklendi.**

`.github/workflows/drift-check.yml` — her iki hedefteki inmiş kopyayı da
doğrular, iki adımda:
1. **Sapma kontrolü** (`check-drift.mjs`) — hedefin kendi manifest'ine karşı;
   Lovable'ın (veya bir başkasının) core dosyalarından birine elle yazması
   senaryosunu yakalar.
2. **Sürüm-gerisi kontrolü** (`check-manifest-freshness.mjs`, **M5-a'da
   eklendi**) — hedefin manifest'i `hasat-core`'un GÜNCEL `core/.manifest`'i
   ile birebir aynı mı? Bekleyen bir sync PR'ı merge edilmeden kalırsa,
   hedef kendi içinde tutarlı ama bayat bir sürümde donar ve eski
   sapma kontrolü tek başına bunu yakalayamazdı — bkz.
   `hasat-vault/Build/Shared-Architecture.md` → "Drift kontrolünün kör
   noktası".

### Gereken secret

| Secret | Ne için |
|---|---|
| `SYNC_TOKEN` | Her iki hedef reposuna da branch push'u + PR açma yetkisi olan bir PAT (`repo` kapsamı). **Kapsamına `hasat-mobile` M5-a'da Berkin tarafından eklendi** (bkz. `hasat-vault/TODO.md` build log) — iki workflow da artık her iki hedefte de çalışabilir durumda. |

---

## İlk kurulum (yapıldı — referans)

Web reposunda subtree bir kez şöyle bağlandı:

```bash
git subtree add --prefix=src/lib/core <hasat-core-url> core-dist --squash
```

Sonraki güncellemeler:

```bash
git subtree pull --prefix=src/lib/core <hasat-core-url> core-dist --squash
```

`core-dist`, `core/` klasörünün `git subtree split` ile üretilmiş dal
karşılığıdır (repo kökü = `core/` içeriği). Action bu dalı kendisi günceller...
