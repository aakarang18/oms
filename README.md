# Casa Atleta — website & registration platform

The website for **Casa Atleta**, a running and endurance-events company in Bareilly, Uttar Pradesh. The first event is **Jhumka City Run** (5K, 10K, 21K Half Marathon and Kids Run).

## What's included
- **Public site:** homepage, event page (distances, schedule, routes, race-day info, FAQs, countdown), About, Contact, Partner with us, legal pages, newsletter popup. It works on phones and has SEO (sitemap, page titles, event data for Google once the date is confirmed).
- **Registration:** 5-step form, Kids Run with parent/guardian details, age and capacity checks, Razorpay payment (UPI, cards, net banking), verified on the server, unique registration IDs (e.g. `JCR-21K-000123`), confirmation emails, and handling of failed, pending and duplicate payments.
- **Admin dashboard** at `/admin`: registration stats, revenue, success rate, registrations per day, cities. Participant search, filters, CSV/Excel export, per-race fee/capacity/open/pause/close, editable event details, FAQs, announcements and sponsors. Inbox for enquiries, audit log, and admin/editor roles.

## Guides
- **[docs/HOSTING_GUIDE.md](docs/HOSTING_GUIDE.md)**: for whoever deploys the site (Supabase, Razorpay, Resend, Vercel, domain, testing, go-live).
- **[docs/ORGANISER_GUIDE.md](docs/ORGANISER_GUIDE.md)**: for the Casa Atleta team using the admin area.

## Running it on a computer (developers)
```bash
npm install
cp .env.example .env.local   # fill in the values
npm run dev                  # http://localhost:3000
```
Without the environment variables, the public pages still work and show "To be announced" placeholders. Registration and admin need Supabase and Razorpay configured.

## Project layout
```
supabase/schema.sql       Database tables + business rules (capacity, payments, stats)
supabase/seed.sql         Jhumka City Run event, races and starter FAQs
src/app/(site)/           Public pages
src/app/admin/            Admin area (login required)
src/app/api/              Registration, payment verification, Razorpay webhook, forms, CSV export
src/components/           Shared UI (header, footer, registration form, popup…)
src/lib/                  Database, payments, email, validation, auth helpers
public/images/            Photos (Unsplash licence, credited in the footer)
```
