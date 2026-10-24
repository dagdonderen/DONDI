// Hak belgesi üretir (ödeme sistemi gelene kadar elle atama için).
// Kullanım: PLAN_SECRET=... node scripts/issue_token.mjs <plan> [gün=31] [kullanıcı-kodu]
import { signEntitlement, PLANS } from "../lib/plans.js";
const [plan, days = "31", sub = ""] = process.argv.slice(2);
if (!plan || !PLANS[plan]) { console.error("Planlar:", Object.keys(PLANS).join(", ")); process.exit(1); }
console.log(signEntitlement({ plan, days: Number(days), sub }));
