# Döndi – Yayın Planı (24 Ekim 2026)

**Sürüm: v1.0.0.** Modlar: Kişisel (mor, ücretsiz) · Finans (mavi; Bireysel/İşletme, ücretli plan v1.2'de).

## Karar: Bugün "Açık Beta" olarak yayınla
Web uygulaması (PWA) zaten canlı. Mağaza, üyelik ve ödeme olmadan **ücretsiz beta** olarak, sınırlı bir gruba (20–50 kişi) aç. Her sürümde (v1.x) otomatik güncellenir; kullanıcı bir şey yapmaz.

## Durum tablosu
| Alan | Durum |
|---|---|
| Kullanıcı izinleri (18+, kamera, konum, belge) | ✅ var, rıza kaydı Redis ile |
| Gizlilik/KVKK, Kullanım şartları | ✅ v1.0.0 (avukat kontrolü önerilir) |
| Veri silme / indirme | ✅ menüden (cihaz + sunucudaki rıza kaydı) |
| Onboarding, ana akış | ✅ |
| Verilerin kaydı | ✅ cihazda (localStorage) |
| Yükleniyor / boş / hata ekranları | ✅ açılış ekranı, boş durum, hata bildirimi |
| İnternet bağlantısı | ✅ çevrimdışı bandı + çevrimdışı kabuk (service worker) |
| Bildirimler | ⚠️ uygulama açıkken hatırlatıcı. Arka plan push için hesap + push servisi gerekir |
| Analytics & crash | ✅ anonim sayaç + hata kaydı (Redis'te; kapatılabilir) |
| Geri bildirim | ✅ menüden |
| Farklı cihaz ekranları | ✅ mobil/masaüstü test edildi. iPhone + Android gerçek cihaz testi sende |
| **Kayıt/giriş, e-posta doğrulama, şifre sıfırlama** | ❌ henüz yok. Bir kimlik servisi ister (öneri: Supabase Auth, ücretsiz katman) |
| **Ödeme & abonelik, satın alım geri yükleme** | ❌ henüz yok. Web için iyzico/Stripe; mağaza uygulamasında Apple/Google ödeme zorunlu |
| **Mağaza yayını** | ❌ Apple Developer (99$/yıl), Google Play (25$) hesabı + sarmalayıcı (Capacitor) gerekir |

## Bugün senin yapacakların (sırayla)
1. Vercel → Storage → Upstash Redis bağla (rıza kaydı, istatistik, geri bildirim için). Env: `HASH_SALT`, `GEMINI_API_KEY`.
2. Redeploy et, menüde **v1.0.0** yazdığını gör.
3. iPhone Safari'de "Ana Ekrana Ekle" ile kur, test kontrol listesi:
   - İlk açılış → yaş onayı → onboarding
   - Yaz, konuş (Safari'de; ana ekran uygulamasında tanıma çalışmaz), kamera, belge yükle
   - Uçak modu → turuncu bant çıkıyor mu
   - Menü → Verilerimi indir / sil / Geri bildirim
4. 20–50 kişiye linki ver, 1 hafta geri bildirim topla (Redis'te `dondi:fb`).

## Sonraki sürümler (öncelik sırası)
- v1.1: Supabase Auth (e-posta+Google giriş, doğrulama, şifre sıfırlama), sohbetlerin bulutta eşitlenmesi, hesap silme.
- v1.2: Finans planı ödemesi (iyzico) + abonelik yönetimi.
- v1.3: bildirimler ve bulut eşitleme; v2.0: Capacitor ile iOS/Android + arka plan bildirimleri.
Not: Hesap + ödeme eklenince Gizlilik metni, şartlar ve ödeme/iade bölümü güncellenmeli; hukuki gözden geçirme yapılmalı.
