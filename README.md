# Driftr (React + Firebase)

Simple MVP dashboard for tracking job applications.

## Local setup

1. Install dependencies:
   - `npm install`
2. Create an env file:
   - `cp .env.example .env`
   - Fill in Firebase env vars (`REACT_APP_FIREBASE_*`)
3. Start the app:
   - `npm start`

## URL auto-fill parser

Backend parser function and deploy instructions live in `functions/README.md`.

## Firebase Storage (Resumes)

Resumes are stored in Firebase Storage at:

- `resumes/{userId}/{resumeId}.pdf` (or `.docx`)

Rules live in `storage.rules` and restrict access to the authenticated user, limit uploads to 5MB, and allow only PDF/DOCX.

To deploy rules:

- `firebase deploy --only firestore:rules,storage`

## Legacy Supabase notes

The section below is from an earlier Supabase version of the project and may be outdated.

### 1) Create the table

In Supabase SQL Editor, run:

```sql
create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  job_title text not null,
  company text not null,
  job_url text,
  date_applied date not null,
  status text not null check (status in ('Applied','Screening','Interview','Offer','Rejected')) default 'Applied',
  resume_version text,
  notes text,
  created_at timestamptz not null default now()
);
```

### 2) Enable Row Level Security (RLS)

For a quick MVP (no auth), you can allow public access. **Do this only for testing**:

```sql
alter table public.applications enable row level security;

create policy "public read" on public.applications for select using (true);
create policy "public insert" on public.applications for insert with check (true);
create policy "public update" on public.applications for update using (true) with check (true);
create policy "public delete" on public.applications for delete using (true);
```

If you want per-user data, add an `user_id uuid` column and use `auth.uid()` in policies.

### 3) Realtime

In Supabase:
- Project Settings → Realtime → ensure Realtime is enabled
- Database → Replication → enable replication for the `applications` table

The app subscribes to Postgres changes and refreshes the list automatically.

## Notes

- Table is sorted by `date_applied` (newest first).
- Response rate counts any status beyond `Applied`.
- Active excludes `Offer` and `Rejected`.
