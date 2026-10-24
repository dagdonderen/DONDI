# Döndi – Kurulum ve Kontrol Rehberi

Bu rehber, sadece sizin hesabınızla yapılabilecek ayarları anlatır. Kod tarafı hazırdır.

## 1) Vercel ortam değişkenleri (Settings → Environment Variables)

| Ad | Değer | Zorunlu mu |
|---|---|---|
| `GEMINI_API_KEY` | Google AI Studio anahtarı | Evet |
| `GEMINI_MODEL` | `gemini-flash-latest` | Evet |
| `GEMINI_FALLBACK_MODEL` | `gemini-3.5-flash-lite` | Önerilir |
| `GEMINI_TTS_MODEL` | `gemini-3.8-flash-tts` | İsteğe bağlı (varsayılan zaten bu) |
| `GEMINI_TTS_VOICE` | `Orus` | İsteğe bağlı |
| `HASH_SALT` | Rastgele uzun bir yazı (örn. 30 karakter) | Önerilir |

Değişkeni ekledikten sonra **Deployments → son dağıtım → ⋯ → Redeploy** yapın. Değişiklik, yeniden dağıtım olmadan çalışmaz.

## 2) Upstash Redis (rıza kaydı + kalıcı günlük limit) — yasal açıdan önemli

1. Vercel'de projeyi açın → **Storage** (veya **Marketplace**) → **Upstash Redis** → **Create**.
2. Bölge olarak **Avrupa (Frankfurt/Ireland)** seçin. Ücretsiz plan yeterli.
3. **Connect to Project** ile Döndi projesine bağlayın. Vercel, `KV_REST_API_URL` ve `KV_REST_API_TOKEN` değişkenlerini kendisi ekler.
4. Redeploy yapın.
5. Kontrol: Uygulamayı yeni bir tarayıcıda açıp 18 yaş onayını verin. Upstash panelinde **Data Browser** → `dondi:consent:*` anahtarının oluştuğunu görmelisiniz. Oluşmuyorsa Vercel → Logs'ta `Rıza kaydı yapılamadı` uyarısı arayın.

## 3) Test listesi (iPhone Safari + bilgisayar)

- [ ] Küreye bir kez dokun → "SOHBET AÇIK", konuş → cevap sesli gelsin. Tekrar dokun → dursun.
- [ ] Menü → Ayarlar → Döndi sesi: Orus/Charon/Algenib dene, "Sesi dene" de.
- [ ] "12 aylık nakit akışı çıkaralım" → tablo ve Excel/Word/CSV/PDF düğmeleri.
- [ ] 📎 ile bir Excel yükle → "özetle" de.
- [ ] "Fiyatı %10 artırırsam ne olur?" → senaryo tablosu.
- [ ] "Dolar kaç?" → güncel değer ve kaynak.
- [ ] "Her ayın 26'sında KDV hatırlat" → hatırlatıcı düğmeleri.
- [ ] Kamera: fatura göster, "bu faturayı tabloya dök".
- [ ] Menü → Verilerimi sil.

Sorun olursa ekran görüntüsü ve Vercel → Logs çıktısı yeterli.

## 4) Yapılmayanlar ve neden

| Konu | Neden yapılmadı | Ne gerekir |
|---|---|---|
| Kullanıcı hesabı ve bulut senkronu | Giriş sistemi ve veritabanı, KVKK yükünü artırır | Karar + hesap/şirket çerçevesi |
| Arka plan bildirimi | Push için sunucu zamanlayıcısı ve bildirim izni akışı | Üstteki hesap sistemi |
| Google Takvim / Gmail bağlantısı | Google OAuth doğrulaması (haftalar sürebilir) | Google Cloud projesi, alan adı doğrulaması |
| Ödeme / ücretli plan | Şirket, vergi, ödeme sağlayıcı sözleşmesi | Şirket kuruluşu |
| App Store / Google Play | Geliştirici hesapları ve mağaza incelemesi | Ücretli hesaplar |
| Vektör veritabanı (Pinecone, Chroma) | Şu an bilgi birikimi yok, gereksiz maliyet | Büyük belge arşivi ihtiyacı doğunca |
| Hukuki metinlerin incelenmesi | Avukat işi | KVKK avukatı: aydınlatma, açık rıza, VERBİS, saklama süreleri |

## Redis bağlantısı (not)
Kod hem Upstash REST (`UPSTASH_REDIS_REST_URL/TOKEN`, `KV_REST_API_URL/TOKEN`) hem de standart `REDIS_URL` (redis:// veya rediss://) ile çalışır. Vercel'de bağlanınca değişken adı fark etmez. `HASH_SALT` değişkenini ayrıca eklemeyi unutma.

## Planlar ve kısıtlar (v1.0)
| Değişken | Anlamı |
|---|---|
| `PLAN_SECRET` | Hak belgelerini (etkinleştirme kodu) imzalamak için uzun rastgele bir yazı. Gizli tut. |
| `BETA_OPEN` | `1` (varsayılan): kodsuz herkes "Beta" planında (geniş özellik, sınırlı kota). `0`: kodsuz herkes Ücretsiz plan. |

Kod üretme (ödeme sistemi gelene kadar elle satış / pilot için):
`PLAN_SECRET=... node scripts/issue_token.mjs sirket_pro 31 musteri-kodu` → çıkan `v1....` kodunu kullanıcıya ver; Menü → Planlar → kodu yapıştırır.
Planlar: ucretsiz, bireysel_plus, bireysel_pro, sirket_plus, sirket_pro, sirket_promax. Tanımlar ve limitler: `lib/plans.js`.

Yasal sayfalar: `legal/sirket.json` dosyasını doldur, sonra `node scripts/build_legal.mjs --strict` çalıştır (eksik alan varsa hata verir). Avukat onayından sonra `"hazir": true` yap.
Maliyet ölçümü: Redis'te `dondi:use:<tarih>` (plan başına token toplamları).
