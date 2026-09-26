# SMM PRO — online kurs platformasi (Cloudflare, bepul)

O'quvchi paneli + admin paneli. Ro'yxatdan o'tish yo'q: login va parolni faqat admin yaratadi.
Darslar YouTube'dagi (Unlisted) videolardan olinadi va **ketma-ket ochiladi** — o'quvchi darsni
oxirigacha ko'rmaguncha keyingisi yopiq turadi.

Platforma **Cloudflare Workers + D1** bepul tarifida ishlaydi: server uxlab qolmaydi, bank kartasi kerak emas,
pullik kurs uchun ishlatish taqiqlanmagan.

## Imkoniyatlar

**O'quvchi**
- Faqat admin bergan login va parol bilan kiradi
- Kurs bo'limlar va darslar ko'rinishida, umumiy progress foizi bilan
- Keyingi dars oldingi dars videosining kamida 90% i ko'rilgandan keyin ochiladi
- Videoni oldinga o'tkazib yuborib bo'lmaydi (faqat ko'rilgan qismga qaytish mumkin); 2x gacha tezlik mumkin
- Qayerda to'xtagani saqlanadi, keyingi safar o'sha joydan davom etadi
- Bitta hisob — bitta qurilma: yangi qurilmadan kirilsa, eskisidan avtomatik chiqariladi

**Admin** (`/admin`)
- O'quvchi qo'shish: login va parol avtomatik yaratiladi, tayyor xabar matnini bir bosishda nusxalab Telegram'da yuborasiz
- Yangi parol berish, hisobni to'xtatish yoki faollashtirish, barcha qurilmalardan chiqarish, progressni nolga tushirish, o'chirish
- Har bir o'quvchi qaysi darsgacha yetganini ko'rish
- Bo'lim va darslarni qo'shish, tahrirlash, tartibini ↑ ↓ bilan o'zgartirish
- YouTube havolasi qo'yilganda video davomiyligi avtomatik aniqlanadi
- Statistika: jami va faol o'quvchilar, kursni tugatganlar, har bir darsni necha kishi ko'rgani

---

## Cloudflare'ga joylash (qadamma-qadam)

Hamma ish brauzerda qilinadi, kompyuterga hech narsa o'rnatish shart emas.

### 1. Kodni GitHub'ga yuklang
1. GitHub'da **private** repozitoriy oching (hozirgisi: `smm-platform`).
2. Zip ichidagi **barcha fayllarni** belgilab (Ctrl+A), GitHub'dagi "Add file → Upload files" sahifasiga sudrab tashlang.
   Hamma fayllar papkasiz, repozitoriy ildizida turadi — shunday bo'lishi kerak. Deploy paytida `build.js`
   sayt uchun kerakli papkalarni o'zi yig'adi.

### 2. Cloudflare hisobini oching
[dash.cloudflare.com](https://dash.cloudflare.com) — ro'yxatdan o'tish bepul, karta so'ralmaydi.

### 3. Loyihani GitHub'dan ulang
1. **Workers & Pages** → **Create application** → **Import a repository** (GitHub'ni ulashga ruxsat bering).
2. Repozitoriyni tanlang. Sozlamalar:
   - **Project name:** `smm-platform` (`wrangler.jsonc` dagi `"name"` bilan bir xil bo'lishi shart)
   - **Build command:** bo'sh qoldiring
   - **Deploy command:** `npx wrangler deploy` (odatda o'zi yozilgan bo'ladi)
   - **Root directory:** `/`
3. **Deploy** ni bosing.

Ma'lumotlar bazasi (D1, nomi `smm-pro-db`) birinchi deploy'da **avtomatik yaratiladi**, jadvallar esa
saytga birinchi kirilganda o'zi paydo bo'ladi — qo'lda hech narsa qilish shart emas.

> **Agar deploy D1 bazasi bo'yicha xato bersa:** **Storage & Databases → D1 → Create database** →
> nomi `smm-pro-db` → yaratilgach **Database ID** ni nusxalang. GitHub'da `wrangler.jsonc` faylini ochib,
> `"database_name": "smm-pro-db"` qatoridan keyin `, "database_id": "NUSXALANGAN-ID"` qo'shing va saqlang —
> Cloudflare qayta deploy qiladi.

### 4. Admin parolini o'rnating — MAJBURIY
1. Worker sahifasi → **Settings** → **Variables and Secrets** → **Add**.
2. **Type:** `Secret`, **Name:** `ADMIN_PASSWORD`, **Value:** kuchli parol → **Deploy**.

Admin logini — `admin`. Boshqasini xohlasangiz, `wrangler.jsonc` dagi `"ADMIN_LOGIN": "admin"` ni o'zgartiring
(buni admin hisobi yaratilishidan, ya'ni birinchi kirishdan oldin qiling).
Birinchi kirgandan keyin parolni panelning **Sozlamalar** bo'limidan o'zgartirish mumkin.

Sessiya kaliti avtomatik yaratilib bazada saqlanadi — alohida sozlash kerak emas.

### 5. Saytni oching
Manzil: `https://smm-platform.SIZNING-NOMINGIZ.workers.dev` (Worker sahifasida ko'rsatiladi).
- `/admin` — admin panel
- `/login` — o'quvchilar kiradigan sahifa

**O'z domeningiz** (masalan `kurs.eplabyoz.uz`) — domen Cloudflare DNS'ga ulangan bo'lishi kerak.
Keyin Worker → **Settings → Domains & Routes → Add → Custom domain**.

### Kodni yangilash
GitHub'dagi faylni o'zgartirsangiz, Cloudflare o'zi qayta joylaydi. Ma'lumotlar (o'quvchilar, darslar, progress) saqlanib qoladi.

---

## Bepul tarif limitlari — bilish shart

| Limit (kunlik) | Bepul tarif | Bu platformada nimaga sarflanadi |
|---|---|---|
| Worker so'rovlari | 100 000 | sahifa ochish + video ko'rilayotganda har 15 soniyada 1 ta hisobot |
| D1 — yozilgan qatorlar | 100 000 | har bir hisobotga 1 ta |
| D1 — o'qilgan qatorlar | 5 000 000 | yetarli |
| D1 — xotira | 5 GB | bir necha MB kifoya |

Taxminiy hisob: kuniga **350–400 soatgacha video ko'rish** bepul limitga sig'adi. 50–100 o'quvchili kurs uchun bu bemalol yetadi.

**Limit tugasa nima bo'ladi:** o'sha kuni progress saqlanmay qoladi va sahifalar xato beradi. Limitlar
har kuni **UTC 00:00** da (Toshkent vaqti bilan **05:00**) yangilanadi. Bunday holat takrorlansa, Workers Paid
tarifiga (oyiga $5) o'ting — kod o'zgarmaydi, bir necha daqiqada kuchga kiradi.

Ishlatilishini kuzatish: Worker sahifasidagi **Metrics** va **Storage & Databases → D1 → smm-pro-db → Metrics**.

---

## Kursni to'ldirish tartibi
1. Videoni YouTube'ga yuklang → **Ko'rinish: Ro'yxatda yo'q (Unlisted)**. Video sozlamalarida
   **"Allow embedding" (joylashtirishga ruxsat)** yoqilgan bo'lsin.
2. Admin → **Kurs tarkibi** → **+ Bo'lim** (masalan "1-modul. SMM asoslari").
3. **+ Dars** → bo'lim, dars nomi, YouTube havolasi — davomiylik o'zi aniqlanadi.
4. Tavsif maydoniga uyga vazifa va havolalarni yozish mumkin (havolalar bosiladigan bo'ladi).
5. Tartibni ↑ ↓ tugmalari bilan o'zgartiring. O'quvchilar darslarni aynan shu tartibda ochadi.

## O'quvchi qo'shish
Admin → **O'quvchilar** → **+ Yangi o'quvchi** → ism-familiya (login va parol bo'sh qolsa avtomatik yaratiladi) →
**"Xabar matnini nusxalash"** → Telegram'da o'quvchiga yuboring. Parol faqat shu oynada bir marta ko'rsatiladi;
yo'qolsa: **⋯ → Yangi parol berish**.

## Cheklovlar
- **Video himoyasi to'liq emas.** Unlisted video havolasini brauzer kodidan topish mumkin. Platforma pleyer ustiga
  himoya qatlamini qo'yadi va YouTube'ga o'tish tugmalarini yopadi — oddiy foydalanuvchilar uchun bu yetarli.
- **iPhone'da birinchi ijro:** ba'zi iPhone'larda birinchi marta videoning o'ziga bosish kerak bo'ladi — platforma buni ko'rsatadi.
- "Ko'rildi" chegarasi — 90%. O'zgartirish uchun `wrangler.jsonc` dagi `COMPLETE_RATIO` ni o'zgartiring (masalan `"0.95"`).
- Darsni o'chirsangiz, o'quvchilarning shu darsdagi progressi ham o'chadi.

## Zaxira nusxa
D1 bazasida **Time Travel** bor: Storage & Databases → D1 → smm-pro-db orqali bazani oxirgi kunlardagi
istalgan holatiga qaytarish mumkin (bepul tarifda bir necha kun).

## Kompyuterda sinash (ixtiyoriy, dasturchilar uchun)
```bash
npm install
echo "ADMIN_PASSWORD=parol123" > .dev.vars
npx wrangler dev
# http://localhost:8787/admin
```
