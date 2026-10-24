# Değişiklik geçmişi

## v1.0.0 (ilk genel sürüm, açık beta)
- Kişisel (mor, ücretsiz) ve Finans modları; Finans içinde Bireysel (mavi) / İşletme (zeytin yeşili) ayrımı.
- Her mod kendi talimat, araç, öneri ve sohbet listesine sahip.
- Finans için aylık ücretsiz hak sayacı (beta'da sınırsız), fiyat anketi sorusu.
- Çevrimdışı bandı, açılış ekranı, hata bildirimi, geri bildirim, veri indir/sil, anonim istatistik.
- Kullanım şartları, gizlilik metni güncellendi.

> Aşağıdakiler v1.0.0 öncesi iç geliştirme geçmişidir (eski numaralarla).

## v1.9.0 (açık beta hazırlığı)
- Çevrimdışı bandı, service worker, açılış ekranı, genel hata bildirimi.
- Geri bildirim formu (/api/feedback), anonim istatistik + hata kaydı (/api/log, kapatılabilir).
- Verilerimi indir (JSON) ve sil (cihaz + sunucudaki rıza kaydı, /api/delete).
- Kullanım şartları sayfası, gizlilik metni 1.2.0, güvenlik başlıkları.
- LANSMAN.md: yayın kararı ve eksik adımlar.

## v1.8.0
- Konuşma paneli pencere olmaktan çıktı: ortalanmış, akan yazı; eski satırlar yukarıda silikleşir.
- Daha büyük küre; cevap metni artık küre altında tekrarlanmıyor.
- Alt çubuk: görsel/belge simgeli yazı hapı, kamera düğmesi, büyük yuvarlak mikrofon (sohbet modu aç/kapat). Yazı yazınca gönder oku çıkar.
- 'Yeni sohbet' ve 'Geçmiş / Ara' ☰ menüsüne taşındı.

## v1.7.1
- Kamera açılınca Döndi otomatik dinler (sohbet modu), "Durdur" düğmesiyle kapanır; her cümlede kameradan kare alınır
- Kamera ekranındaki hazır komut düğmeleri kaldırıldı

## v1.7.0
- Senaryo karşılaştırma aracı (fiyat, adet, maliyet, sabit gider, tek seferlik harcama)
- Tarihli ödeme/vade hatırlatıcıları ("her ayın 26'sı KDV")
- Word (.doc) raporu: tüm CFO sonuçlarında Excel / Word / CSV / PDF
- İşletme profili (Ayarlar): sektör, gelir, gider, nakit, borç, KDV; hesaplarda varsayılan
- Web arama aracı (Google Arama ile kaynaklı güncel veri: kur, faiz, mevzuat)
- Fatura/fiş/ekstre fotoğrafı veya PDF'inden kalem çıkarma kuralları
- Yeni kısayollar: Ya şöyle olsa?, Vergi takvimi, Güncel kur

## v1.6.0
- Kamera ekranı yeni tasarım
- 8 erkek ses seçeneği (Orus, Charon, Algenib…)
- Açık tema ve büyük yazı boyutu

## v1.5.0
- Sohbet modu: küreye bir kez dokununca Döndi sürekli dinler ve cevap verir; tekrar dokununca durur
- Seni duymazsa kendini yeniden başlatır; art arda 6 kez duymazsa durup uyarır

## v1.4.1
- Yazı ve ses eşleşti: sesli cevapta metin, ses başladığı anda ekrana gelir
- İlk ses parçası kısa tutuldu, konuşma daha erken başlar

## v1.4.0
- Erkek ses (Gemini TTS, Orus), Ayarlar'dan telefon sesine dönülebilir; hata olursa telefon sesine otomatik düşer

## v1.3.2
- Konuşma tanıma hızlandı: sustuğunda ~1 sn içinde gönderilir (önceden tarayıcının uzun sessizlik beklemesine bağlıydı)
- iPhone/Safari'de sesli cevap için ses çıkışı ilk dokunuşta açılıyor
- iPhone ana ekran uygulamasında ses tanıma kısıtı için açıklayıcı uyarı

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
