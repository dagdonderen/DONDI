# Döndi

Sesle ve yazıyla konuşan, kamerayla görebilen, nakit akışı ve maliyet hesabı yapabilen kişisel asistan (PWA).
Marka: DAĞDÖNDEREN · Yalnızca 18 yaş ve üzeri.

- `public/` — arayüz (index.html, gizlilik.html, manifest, ikonlar)
- `api/chat.js` — Gemini sohbet, araçlar (hava, CFO, hatırlatıcı, web arama)
- `api/tts.js` — Döndi erkek sesi (Gemini TTS)
- `api/consent.js` — rıza kayıtları (Upstash Redis)
- `lib/cfo.js` — nakit akışı, maliyet, senaryo hesapları

Kurulum ve kontrol listesi: [KURULUM.md](KURULUM.md) · Sürüm notları: [CHANGELOG.md](CHANGELOG.md)

Yerelde denemek için: `npx vercel dev` (ortam değişkenleri gerekir).
