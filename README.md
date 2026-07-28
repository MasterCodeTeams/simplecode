# Master Code

Web editor GitHub lengkap: login GitHub, edit/buat/hapus file, buat & hapus branch,
buat repository baru, pengaturan repository, issues + komentar, releases, upload
file **atau folder** sekaligus (fitur yang GitHub web bawaan tidak punya), dan
saran kode AI (gratis, pakai Groq) mirip Copilot — tekan `Tab` untuk terima saran.
Tampilan sudah responsive: enak dipakai di HP maupun desktop.

## 1. Buat GitHub OAuth App

1. Buka https://github.com/settings/developers → **New OAuth App**
2. Homepage URL: `https://www.mastercode.my.id` (isi `http://localhost:3000` dulu kalau masih lokal)
3. Authorization callback URL:
   - Lokal: `http://localhost:3000/api/auth/callback/github`
   - Production: `https://www.mastercode.my.id/api/auth/callback/github`
4. Simpan `Client ID` dan `Client Secret`

## 2. Buat API Key Groq (GRATIS, buat fitur AI suggestion)

1. Daftar di https://console.groq.com
2. Buat API key baru
3. Simpan key-nya

## 2b. (Opsional) Token Vercel — buat fitur Live Preview

1. Buka https://vercel.com/account/tokens → **Create Token**
2. Simpan token-nya sebagai `VERCEL_TOKEN`
3. Kalau project kamu di bawah Team (bukan Personal Account), isi juga `VERCEL_TEAM_ID`
   (lihat di Team Settings → General → Team ID)
4. Fitur ini nyari otomatis project Vercel mana yang terhubung ke repo yang lagi
   kamu buka — jadi repo itu emang harus sudah di-import ke Vercel dulu (lewat
   `vercel.com/new` atau `vercel` CLI) biar ada datanya
5. Kalau project Vercel-nya pakai Deployment Protection (Vercel Authentication),
   preview-nya bakal kena halaman "request access" tiap dibuka. Biar langsung
   tembus tanpa itu: Project Settings → Deployment Protection → **Protection
   Bypass for Automation** → generate secret → isi sebagai `VERCEL_AUTOMATION_BYPASS_SECRET`

## 2b-2. (Opsional) Token Netlify — sama kayak Vercel, provider alternatif

1. Buka https://app.netlify.com/user/applications → **Personal access tokens** → **New access token**
2. Simpan token-nya sebagai `NETLIFY_TOKEN`
3. Sama kayak Vercel, fitur ini nyari otomatis site Netlify mana yang terhubung
   ke repo yang lagi kamu buka — repo-nya harus udah di-link ke site Netlify dulu
   (lewat Netlify UI: **Add new site → Import an existing project**)
4. Boleh setup Vercel aja, Netlify aja, atau dua-duanya sekaligus — Master Code
   otomatis nampilin Live Preview & status deploy cuma buat provider yang
   beneran terhubung ke repo itu

## 2c. (Opsional) Supabase — buat fitur Survey/Live

1. Bikin project gratis di https://supabase.com
2. Buka **SQL Editor**, jalanin ini buat bikin tabelnya:

   ```sql
   create table survey_responses (
     id uuid primary key default gen_random_uuid(),
     login text not null,
     avatar_url text,
     week_key text not null,
     opinion text not null,
     has_issue boolean not null,
     issue_detail text,
     suggestion text not null,
     created_at timestamptz not null default now(),
     unique (login, week_key)
   );
   create index survey_responses_week_idx on survey_responses (week_key, created_at desc);
   ```

3. Buka **Settings → API**, copy **Project URL** → `SUPABASE_URL`
4. Di halaman yang sama, copy **service_role key** (bukan `anon` key!) →
   `SUPABASE_SERVICE_ROLE_KEY`. Key ini cuma dipakai di server (route API),
   jangan pernah ditaruh di kode yang jalan di browser.

## 2d. (Opsional) Owner Panel — statistik user

Butuh Supabase yang sama seperti di atas, plus 1 tabel tambahan. Di **SQL
Editor** Supabase, jalanin:

```sql
create table user_activity (
  login text primary key,
  avatar_url text,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  total_active_seconds bigint not null default 0
);
```

Owner Panel (`/owner`) cuma bisa dibuka akun GitHub `@MasterCodeTeams`
(hardcoded di `lib/owner.ts`) dan nampilin: jumlah user terdaftar, jumlah
user aktif (24 jam terakhir), rata-rata user aktif bulanan (30 hari
terakhir), rata-rata waktu pakai per user, dan rata-rata pengirim survey
per minggu.

## 2e. (Opsional) Live Preview — token Protection Bypass per-repo

Kalau mau simpan token "Protection Bypass for Automation" (Vercel) per
repository lewat menu **Settings → Live Preview**, butuh Supabase (sama
seperti di atas) plus 1 tabel tambahan. Di **SQL Editor** Supabase, jalanin:

```sql
create table vercel_protection_tokens (
  owner text not null,
  repo text not null,
  bypass_secret text not null,
  updated_at timestamptz not null default now(),
  primary key (owner, repo)
);
```

Tanpa tabel ini, nyimpen token di Settings bakal gagal dengan error
`Could not find the table 'public.vercel_protection_tokens'`.

## 2f. (Opsional) Komunitas & Announcement

Butuh Supabase (sama seperti di atas). Di **SQL Editor** Supabase, jalanin:

```sql
create table community_messages (
  id uuid primary key default gen_random_uuid(),
  login text not null,
  avatar_url text,
  type text not null default 'text',
  content text,
  poll_id uuid,
  created_at timestamptz not null default now()
);
create index community_messages_created_idx on community_messages (created_at);
create index community_messages_login_idx on community_messages (login);

create table community_polls (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  options jsonb not null,
  created_by text not null,
  ends_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table community_poll_votes (
  poll_id uuid not null,
  login text not null,
  option_id text not null,
  created_at timestamptz not null default now(),
  primary key (poll_id, login)
);

create table community_meta (
  key text primary key,
  value text
);

create table announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  created_by text not null,
  avatar_url text,
  created_at timestamptz not null default now()
);
create index announcements_created_idx on announcements (created_at desc);

create table announcement_comments (
  id uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references announcements(id) on delete cascade,
  login text not null,
  avatar_url text,
  content text not null,
  created_at timestamptz not null default now()
);
create index announcement_comments_ann_idx on announcement_comments (announcement_id, created_at);

create table announcement_meta (
  key text primary key,
  value text
);
```

Terus bikin **1 storage bucket** (ini lewat Dashboard, bukan SQL): buka
**Storage** di sidebar Supabase → **New bucket** → nama `community-uploads`
→ aktifkan **Public bucket**. Ini tempat nyimpen gambar yang dikirim di
`/komunitas`.

**Cara kerja fitur ini:**
- `/komunitas`: chat global. Semua user maks. **50 pesan per 30 menit**
  (dihitung otomatis, gak perlu setting apa-apa). **Semua pesan & polling
  ke-reset (kehapus) otomatis tiap 30 menit** buat semua orang — reset-nya
  dicek pas ada yang buka/kirim chat (bukan pakai cron server terpisah)
- Cuma akun `@MasterCodeTeams` (lihat `lib/owner.ts`) yang bisa bikin
  **Global Polling** — pesan khusus yang tersemat di chat dengan timer
  yang bisa diatur, semua user bisa vote
- `/announcement`: cuma owner yang bisa bikin pengumuman baru (pengumuman-
  nya PERMANEN, gak pernah ke-reset). Semua user bisa komentar di tiap
  pengumuman — **komentarnya ke-reset (kehapus) otomatis tiap 45 menit**,
  pakai mekanisme yang sama kayak reset chat komunitas

## 3. Setup environment variable

Copy `.env.example` jadi `.env.local`, lalu isi:

```
GITHUB_ID=...
GITHUB_SECRET=...
NEXTAUTH_SECRET=... (generate: openssl rand -base64 32)
NEXTAUTH_URL=http://localhost:3000
GROQ_API_KEY=...
ALLOWED_GITHUB_USERS=username_github_kamu
```

> **`ALLOWED_GITHUB_USERS`** ini pengaman: hanya username GitHub yang kamu daftarkan
> di sini yang bisa login ke aplikasi ini. Kalau ada orang lain buka link app kamu
> dan coba login pakai akun mereka sendiri, otomatis ditolak. Bisa isi beberapa
> username dipisah koma, contoh `budi,siti`. Kosongkan variable ini kalau memang
> mau semua orang boleh login (masing-masing tetap hanya bisa akses repo mereka
> sendiri, bukan repo kamu).


## 4. Jalankan lokal

```bash
npm install
npm run dev
```

Buka http://localhost:3000

## 5. Deploy ke Vercel

1. Push project ini ke repository GitHub kamu
2. Import repo di https://vercel.com/new
3. Di **Environment Variables**, isi semua variabel yang sama seperti `.env.local`,
   tapi `NEXTAUTH_URL` diisi domain kamu, contoh `https://www.mastercode.my.id`
4. Deploy
5. Balik lagi ke GitHub OAuth App settings, update Authorization callback URL
   ke domain Vercel yang sudah jadi

## Fitur

- Login via GitHub OAuth (scope penuh: repo, delete_repo, workflow, user:follow)
- Dashboard: cari & lihat semua repo, buat repo baru (private/public, gitignore template)
- File explorer lengkap (tree recursive, folder bisa dibuka/tutup)
- Buat, edit, simpan (commit), hapus file
- Buat folder (via placeholder `.gitkeep`, sesuai cara kerja Git)
- **Upload file maupun folder sekaligus** dalam satu commit (pakai Git Trees API)
- Buat & hapus branch, pindah branch
- Commit dengan pesan custom
- Issues: buat issue, lihat & kirim komentar
- Releases: buat release/tag, tandai pre-release, lihat daftar release
- Pengaturan repository: deskripsi, default branch, visibility (public/private),
  aktifkan/nonaktifkan issues & wiki, hapus repository (danger zone)
- **Logs**: riwayat semua perubahan (commit history) per repo, klik buat lihat file
  apa saja yang berubah beserta diff-nya (baris ditambah/dihapus)
- **Explore Public Repo**: cari & lihat repository publik siapapun di GitHub,
  mode read-only otomatis kalau bukan repo milik sendiri, dengan tombol:
  - **Download ZIP** — download langsung repo publik apa saja
  - **Copy** — salin isi repo publik jadi repo *milik sendiri sepenuhnya*
    (bukan GitHub fork), bisa langsung diatur **private**, dan bisa pilih:
    bikin repo baru ATAU timpa ke salah satu repo kamu yang sudah ada
- **Test**: 2 bagian dalam satu tombol —
  - **Live Preview**: nunjukin website beneran jalan (deployment Vercel yang cocok
    dengan repo & branch aktif), status build real-time, tombol **Stop** buat
    batalin deployment yang lagi building, bisa dilihat langsung lewat iframe
    di dalam app atau buka tab baru (butuh `VERCEL_TOKEN`, opsional)
  - **Build & Test (CI)**: trigger GitHub Actions, pantau status (antri/jalan/
    sukses/gagal), riwayat run, dan generate workflow CI dasar otomatis kalau
    repo belum punya sama sekali
- **Search** (`/search`): cari repository ATAU user GitHub, ada filter tab,
  hasil klik langsung ke halaman overview
- **Profil User** (`/users/[username]`): lihat profil siapa aja, bio, lokasi,
  daftar repo mereka, tombol **Follow/Unfollow**, lihat daftar **Followers**
  & **Following**. Kalau itu profil kamu sendiri, ada tombol Edit Profil
- **Repository Overview** (`/repository/[owner]/[repo]`): halaman ala GitHub
  — README ke-render rapi, statistik (star, fork, watcher), tombol
  **Favorite/Star**, tombol buka langsung ke editor
- **Settings** (`/settings`): edit profil GitHub kamu sendiri (nama, bio,
  perusahaan, lokasi, website, Twitter/X) langsung dari app
- **Auto-refresh (live)**: angka followers/following/repos/star, ke-refresh
  tiap 8 detik (daftar followers/following tiap 15 detik) selama halaman
  dibuka & tab aktif — berhenti otomatis kalau tab di-minimize, biar hemat
  jatah API GitHub. Update-nya TIDAK PERNAH reload halaman atau nunjukin
  loading spinner; angka yang berubah cuma berkedip halus (hijau = nambah,
  merah = berkurang) sekilas lalu balik normal, jadi gak mengganggu
- AI code suggestion gratis (Groq) — ghost text inline di editor, tekan Tab untuk terima
- Responsive penuh: sidebar jadi drawer di HP, tetap fixed di desktop
- Whitelist login (`ALLOWED_GITHUB_USERS`) + middleware server-side, biar cuma kamu
  yang bisa akses dashboard/editor meski URL app-nya diketahui orang lain

## Catatan

- **Kalau kamu update dari versi sebelumnya**: scope OAuth login utama nambah
  `user:follow` (buat fitur Follow). Token lama yang udah kamu punya TIDAK
  otomatis dapet scope baru ini — **logout dulu, terus login ulang** biar
  GitHub minta izin ulang dengan scope yang baru. Kalau enggak, tombol
  Follow/Unfollow bakal gagal dengan error izin.
- Semua request ke GitHub API dilakukan lewat API route Next.js di server
  menggunakan access token dari sesi NextAuth, jadi token tidak pernah
  ter-expose ke client.
- Model AI default: `llama-3.1-8b-instant` (Groq), cepat & masih di dalam
  kuota gratis untuk pemakaian wajar. Bisa diganti di `lib/groq.ts`.
