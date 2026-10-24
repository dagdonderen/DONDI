# Döndi v1.0 – Ücret Politikası (özel, iç belge)
Tarih: 24 Ekim 2026. Fiyatlar TL, KDV dahil. Yıllık = 10 ay (2 ay hediye).

| Plan | Aylık | Yıllık | Mesaj/ay | Gün/mesaj | Belge/ay | Web arama/ay | Sesli cevap/gün | Model | Öne çıkan |
|---|---|---|---|---|---|---|---|---|---|
| Ücretsiz (Kişisel + Finans denemesi) | 0 | – | 200 | 15 | – | 10 | 9 | Lite | Finans aracı denemesi 3/ay |
| Bireysel Plus | 149 | 1.490 | 500 | 40 | – | 20 | 30 | Lite | Hesap araçları, dışa aktarım |
| Bireysel Pro | 349 | 3.490 | 600 | 60 | 20 | 60 | 75 | Flash | + Senaryo, belge analizi |
| Şirket Plus | 599 | 5.990 | 800 | 60 | – | 40 | 90 | Lite | Şirket finans işlemleri |
| Şirket Pro | 1.199 | 11.990 | 1.500 | 120 | 60 | 150 | 180 | Flash | + gelişmiş işlemler, belge |
| Şirket Pro Max | 2.499 | 24.990 | 3.000 | 200 | 120 | 300 | 360 | Flash | + FIRDÖNDÜ bağlantısı (cari/proje/çek, e-posta ile belge) |

Beta (BETA_OPEN=1, kodsuz herkes): 300 mesaj/ay, 30/gün, 5 belge, 20 arama, 30 ses/gün; FIRDÖNDÜ hariç özellikler açık.

## Maliyet varsayımları (TAHMİN – gerçek ölçümle doğrulanacak)
- Gemini 3.8 Flash $0,75/$3,75 (1M token), 31 Aralık 2026'ya kadar; 1 Ocak 2027'de iki katına çıkıyor → Ocak 2027'de fiyat ve kotalar yeniden gözden geçirilecek.
- Google Search grounding $14/1000 istek (ayda 5000 ücretsiz, paylaşımlı).
- TTS ses çıktısı $9/1M token (2027'de 2 katı).
- Yaklaşık birim: metin mesajı 0,1–0,3 TL, sesli cevap parçası ~0,2 TL, web arama ~0,7 TL, belge analizi ~1,5 TL.
- Ölçüm: Redis `dondi:use:<gün>` alanları `{plan}|in/out/calls`. İlk 30 gün sonunda plan başına gerçek maliyet çıkarılıp fiyat/kota ayarlanır.

## Kararlar
- Kısıtlar sunucuda uygulanır (araç, aylık mesaj, günlük üst sınır, belge, arama, sesli cevap, model). İstemci sadece gösterir.
- Hak belgesi: HMAC imzalı etkinleştirme kodu (PLAN_SECRET). Ödeme sistemi gelene kadar elle satış/pilot: scripts/issue_token.mjs.
- Aylık KDV dahil gösterim; yenileme öncesi 7 gün bildirim; fiyat değişikliği 30 gün önceden bildirim; tek tıkla iptal; yıllıkta kıst iade.
- Cayma: dijital hizmetin açık onayla anında ifası istisnası kullanılacak (onay kutusu ödeme akışında zorunlu) – avukat onayı gerekli.
- Pro Max: FIRDÖNDÜ lisansıyla paketlenebilir; veri işleyen/sorumlusu rolleri Şirket Hizmet Sözleşmesi'nde özetlendi.

## Satıcı bilgileri ve ödeme sağlayıcı (24 Ekim 2026)
- Satıcı: Alaaddin DAĞDÖNDEREN (gerçek kişi), Merkez / Kütahya, 0505 692 6546, yetkili mahkeme Kütahya. Vergi levhası/işletme kaydı henüz yok.
- Seçilen ödeme sağlayıcı: **PayTR**. Sebep: sanal POS komisyonu 2,19%'dan başlıyor (sektöre/hacme göre teklif), aylık sabit ücret ve kurulum ücreti yok, başvuruda "Bireysel Başvuru (vergi levham yok / muafım)" seçeneği var (PayTR sayfası, Eylül 2026). Komisyon ve vade teklifle belli olur.
- Yedek: iyzico. Şirketlere sanal POS %4,29 + 0,25 TL; şirketsiz bireyler için Link ürünü %4,49 + 0,25 TL (ideasoft özeti, Ekim 2026). Daha pahalı.
- Abonelik (otomatik yenileme) için kart saklama/tekrarlı tahsilat PayTR'de ayrıca açılıp açılmadığı başvuruda sorulacak; olmazsa dönemlik (aylık/yıllık) tek seferlik ödeme + yenileme hatırlatması.
- VERGİ UYARISI (mali müşavir/avukat teyidi şart): Düzenli ücretli yazılım/abonelik satışı ticari kazanç sayılır; vergi mükellefiyeti (şahıs işletmesi kaydı, vergi dairesi) ve fatura/e-arşiv yükümlülüğü doğabilir. Ücretli satışa başlamadan önce şahıs işletmesi kaydı önerilir. O zamana kadar uygulama ücretsiz betada kalır. Vergi dairesi ve vergi no, legal/sirket.json'a eklenince sözleşmelerdeki boşluklar dolar.

## Lansman öncesi açık işler
1. legal/sirket.json: unvan, adres, telefon, ödeme sağlayıcı (PayTR), mahkeme (Kütahya) dolu. Eksik: vergi dairesi, vergi no (şahıs işletmesi kaydı sonrası); MERSİS gerçek kişide yok, şablondan çıkarılacak; KEP isteğe bağlı.
2. Avukat incelemesi, sonra `"hazir": true` ve `node scripts/build_legal.mjs --strict`.
3. Ödeme sağlayıcı seçimi (iyzico / PayTR vb.) ve satın alma + iptal akışı.
4. Vercel env: PLAN_SECRET, HASH_SALT; beta bitince BETA_OPEN=0.

## Özellik kapıları (güncel)
- hesap (Plus ve üstü): nakit akışı, maliyet, bütçe-sapma, gelir-gider tahmini, rapor taslağı.
- senaryo (Pro ve üstü): senaryo karşılaştırma.
- analiz (Pro ve üstü): bilanço oran analizi, şüpheli harcama tespiti, kredi risk puanı, KAP/piyasa analizi (tavsiyesiz; web arama kotasından düşer).
- belge (Pro ve üstü): uzun belge/mevzuattan bilgi çekme. Aynı belge üzerindeki devam soruları yeni belge sayılmaz.
- Ücretsiz: finans araçlarından ayda 3 deneme. Beta: hepsi açık (FIRDÖNDÜ hariç).
