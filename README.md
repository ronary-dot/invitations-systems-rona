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

## מבנה הפרויקט

```
src/app/              נתיבים (App Router)
src/components/       קומפוננטות משותפות
src/i18n/             הגדרות שפה, קריאת locale מעוגייה
src/lib/supabase/     לקוחות Supabase: דפדפן, שרת, admin, proxy
src/proxy.ts          רענון session והגנה על /admin
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
