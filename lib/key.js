// Kullanıcının kendi Gemini API anahtarı. Her kullanıcı kendi anahtarıyla çalışır; kullanım ücreti kendi Google hesabına yansır.
// Anahtar her istekte cihazdan "X-Gemini-Key" başlığıyla gelir. Sunucu onu yalnız o isteği Google'a iletmek için kullanır:
// saklamaz, Redis'e yazmaz, günlüğe yazmaz. Sunucudaki GEMINI_API_KEY kullanıcı istekleri için ASLA kullanılmaz.
export const KEY_RE = /^AIza[0-9A-Za-z_-]{35}$/;

export function userKey(req) {
  const k = String(req.headers?.["x-gemini-key"] || "").trim();
  return KEY_RE.test(k) ? k : null;
}

export const NEED_KEY = {
  error: "Döndi kendi Gemini API anahtarınla çalışır. Ayarlar'dan anahtarını gir.",
  needKey: true,
};

export const BAD_KEY = {
  error: "Gemini API anahtarın geçersiz ya da yetkisiz. Ayarlar'dan kontrol et.",
  needKey: true,
};

// Google'ın "anahtar geçersiz / yetkisiz" cevabı mı?
export function isKeyError(status, data) {
  if (status !== 400 && status !== 401 && status !== 403) return false;
  const s = JSON.stringify(data || {});
  return /API_KEY_INVALID|API key not valid|API_KEY_SERVICE_BLOCKED|PERMISSION_DENIED|UNAUTHENTICATED/i.test(s);
}
