# invitations-systems-rona
מערכת הזמנות רונית

מערכת ליצירת הזמנות דיגיטליות לאירועים, שליחתן למוזמנים (אימייל מהמערכת, וואטסאפ בקישורי `wa.me` ידניים) ומעקב אחרי אישורי הגעה.

האפיון ותכנית העבודה: [docs/work-plan.md](docs/work-plan.md)

## טכנולוגיה

- Next.js 16 (App Router, TypeScript), Tailwind CSS 4
- Supabase: Postgres, Auth, Storage
- next-intl: עברית (ברירת מחדל, RTL) ואנגלית. השפה נשמרת בעוגייה ולא בכתובת, כך שלכל אירוע ולכל מוזמן יש קישור אחד
- Gmail (סיסמת אפליקציה) לשליחת מיילים
- Vercel לאירוח

## הרצה מקומית

```bash
npm install
cp .env.example .env.local
# מלא את משתני Supabase בקובץ .env.local
npm run dev
```

האתר עולה ב-http://localhost:3000.

## Supabase

סכמת הדאטאבייס נמצאת ב-`supabase/migrations/`. כל הטבלאות עם קידומת `inv_`.

0. הפרויקט: `invitations-rona` (ref `mrtzofgdnkjscfhiahfg`, אזור eu-central-1). המיגרציות כבר הוחלו עליו.
1. לפרויקט חדש: הרץ את קבצי ה-migration לפי הסדר ב-SQL Editor, או `supabase db push`
2. העתק מ-Project Settings > API את ה-URL, ה-publishable key וה-secret key ל-`.env.local`

### הוספת עובד

1. Authentication > Users > Add user (אימייל + סיסמה, Auto Confirm)
2. ב-SQL Editor:

```sql
select public.inv_add_staff('person@example.com', 'שם לתצוגה');
```

## שליחת הזמנות

- **וואטסאפ:** בקישורי `wa.me` בלבד. במסך המוזמנים, כפתור "וואטסאפ" ליד כל מוזמן או "שליחה רציפה" שעוברת מוזמן אחרי מוזמן. וואטסאפ נפתח עם ההודעה מוכנה, ולוחצים "שלח". המוזמן מסומן "נשלח".
- **אימייל:** דרך Gmail עם סיסמת אפליקציה:
  1. בחשבון Google: Security > 2-Step Verification (חייב להיות פעיל) > App passwords, ליצור סיסמה.
  2. להגדיר `GMAIL_USER` ו-`GMAIL_APP_PASSWORD` (ב-Vercel: Settings > Environment Variables). אופציונלי: `EMAIL_FROM_NAME` לשם השולח.
  3. חשבון Gmail רגיל מוגבל לכ-500 מיילים ביום.
- לפני שליחה לכולם: "שלח מייל בדיקה אליי".
- נוסח ההודעה נקבע בטופס האירוע. `{name}` מוחלף בשם המוזמן ו-`{link}` בקישור האישי.
- כל שליחה נרשמת ב"יומן שליחות" בתחתית מסך המוזמנים.
- `/api/health` מראה אם החיבור ל-Supabase ולמייל תקין (בלי לחשוף סיסמאות).

## מבנה הפרויקט

```
src/app/              נתיבים (App Router)
src/components/       קומפוננטות משותפות
src/i18n/             הגדרות שפה, קריאת locale מעוגייה
src/lib/supabase/     לקוחות Supabase: דפדפן, שרת, admin, proxy
src/proxy.ts          רענון session והגנה על /admin
src/lib/types/        טיפוסי הדאטאבייס (נוצרו מ-Supabase)
src/templates/        רישום התבניות (העיצובים עצמם בשלב 2)
messages/             קבצי תרגום he.json, en.json
supabase/migrations/  סכמת DB
docs/                 אפיון ותכנית עבודה
```

## פקודות

```bash
npm run dev     # פיתוח
npm run build   # בנייה
npm run start   # הרצת גרסת production
npm run lint    # ESLint
```
