# متابعة الثانوية الأزهرية

موقع لمتابعة مذاكرة طلاب الثانوية الأزهرية درساً بدرس: https://shadyyasser.github.io/azhar-thanaweya-tracker/

- الخطة الكاملة: [خطة-الموقع.md](خطة-الموقع.md) · القواعد التقنية: [CLAUDE.md](CLAUDE.md)
- المحتوى: `content/` · قاعدة البيانات: `supabase/migrations/`

## Development

```sh
cp .env.example .env     # public Supabase URL + publishable key
npm install
npm run dev              # http://localhost:5173/azhar-thanaweya-tracker/
npm run build            # typecheck + production build into dist/
npm run check:content -- --base origin/main   # lesson-ID safety check (also runs in CI)
```

Quizzes: add `content/grades/<grade>/quizzes/<lessonId>.json` (format in the plan, section 5;
validated by the content check). The lesson shows a quiz button once the file exists.

Every push to `main` runs the content check, builds, and deploys to GitHub Pages
(`.github/workflows/deploy.yml`). Pull requests run the check and the build only.

## Database

Apply the files in `supabase/migrations/` in order (Supabase SQL Editor or `supabase db push`).
The first admin is set once from the SQL Editor; after that, admins change roles from
the admin page (the last admin cannot be demoted). To make an account admin after it signs up:

```sql
update public.profiles set role = 'admin'
where id = (select id from auth.users where email = 'you@example.com');
```
