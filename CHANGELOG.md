# Döndi sürüm notları

## v1.3.1
- Marka paleti: sıcak siyah, bakır ve altın (varsayılan "Altın" teması; Mavi/Mor/Yeşil seçenekleri durur)
- Yeni uygulama ikonu (D ve yörüngedeki ürün simgeleri), manifest renkleri güncellendi

## v1.3.0 (arayüz yenilemesi)
- Yeni tasarım: cam efektli, mobil öncelikli, tek sütun; HUD halkaları yerine nefes alan küre
- Sağdaki hızlı komutlar paneli kaldırıldı
- Sol bilgi/sistem kutusu yalnızca ilk kullanımda ~15 sn görünür
- Mesaj kutusu artık ayrı buton değil: "Kamerayı aç" butonunun altında her zaman açık
- Ses, Sürekli, Ayarlar, İzinler, Gizlilik, Verilerimi sil bir menüye taşındı

## v1.2.0
- Belge yükleme (📎): Excel, Word (.docx), PDF, CSV, TXT analizi; ilk kullanımda ayrı onay + kayıt
- Nakit akışı ve maliyet sonuçları Excel / CSV / PDF olarak indirilebilir
- Hatırlatıcı ve zamanlayıcı (uygulama açıkken bildirim + ses), takvime ekle (.ics)

## v1.2.0-cfo
- CFO modülü: aylık nakit akış tablosu (gelir/gider kalemleri, büyüme, nakit açığı, dayanma süresi)
- Maliyet hesabı: birim maliyet, KDV, kâr marjı, fiyat önerisi, başabaş adedi
- Hesaplar sunucuda kodla yapılır (lib/cfo.js); sohbette tablo gösterimi

## v1.1.0
- Birden fazla sohbet: yeni sohbet, geçmişten seçme, silme (eski tek sohbet otomatik taşınır)
- Geçmişte arama (başlık ve mesaj içeriği)

## v1.1.0-beta
- Ayarlar paneli: ad, konuşma tonu (samimi/resmi/enerjik/kısa), ses seçimi, konuşma hızı, tema rengi
- Ad ve ton cevaplara yansıyor

## v1.0.2
- İzinler tek kutuda satır satır (yaş onayı + mikrofon + konum + bilgi satırları)
- Rıza kayıtları sunucuda tutuluyor (api/consent.js, Upstash Redis gerekir): yaş, konum, kamera rızası/geri alma
- Gizlilik metnine rıza kaydı bölümü

## v1.0.1
- Kamera öncesi ayrı Açık Rıza Metni: özel nitelikli veri, Google aktarımı ve Vercel aktarımı için üç ayrı onay kutusu (katmanlı ayrıntılarla)
- Rızayı geri alma butonu
- 18+ yaş onayı (ilk açılış)
- Veri sorumlusu ve iletişim bilgileri gizlilik metnine işlendi

## v1.0
- Yazılı ve sesli sohbet, HUD arayüzü
- Konuma göre hava durumu (Open-Meteo)
- Kamera: nesne tanıma, çevre, cilt (tanı koymaz), yazı okuma
- Adım adım izin sihirbazı
- Gizlilik / KVKK aydınlatma sayfası, "Verilerimi sil", uyarı satırı
- Telefon simgeleri (PNG), sürüm numarası
- Kalıcı günlük limit (Upstash Redis tanımlıysa)

## Kurulum denetim listesi (v1.0 öncesi)
- [ ] gizlilik.html içindeki [AD SOYAD] ve [E-POSTA] alanları dolduruldu, sarı not kutusu silindi
- [ ] Avukat / KVKK danışmanı metni inceledi
- [ ] Vercel: GEMINI_FALLBACK_MODEL = gemini-3.5-flash-lite
- [ ] Upstash Redis bağlandı, Redeploy yapıldı (isteğe bağlı ama önerilir)
- [ ] iPhone ve Android'de test edildi
