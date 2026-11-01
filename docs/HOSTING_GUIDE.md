# Casa Atleta website — hosting & launch guide

This guide is for the person who will put the website live. It takes about **2–3 hours** the first time.

**What the website uses (all have free tiers to start):**

| Service | What it does | Sign up |
|---|---|---|
| **GitHub** | Stores the code (this repository) | github.com |
| **Vercel** | Runs the website, connects the domain, SSL | vercel.com |
| **Supabase** | Database + admin logins (choose region **Mumbai / ap-south-1**) | supabase.com |
| **Razorpay** | Online payments: UPI, cards, net banking | razorpay.com (needs business KYC) |
| **Resend** | Sends confirmation and notification emails | resend.com |

Tech stack: Next.js 14 (App Router, TypeScript), Supabase Postgres, Razorpay Orders + Checkout + Webhooks, Resend. Node 18.18+.

---

## 1. Get access to the code
The owner adds you as a collaborator on the GitHub repository (**Settings → Collaborators → Add people**). You only need **read** access if Vercel is connected from the owner's GitHub account; give **write** access if you will make changes.

## 2. Supabase (database)
1. Create a new project (region: **Mumbai**). Save the database password somewhere safe.
2. Open **SQL Editor → New query**, paste the whole of `supabase/schema.sql`, click **Run**.
3. New query again, paste `supabase/seed.sql`, click **Run**. This creates Jhumka City Run, its four races (5K, 10K, 21K, Kids Run) and starter FAQs.
4. **Project Settings → API**: copy the **Project URL**, the **anon public** key and the **service_role** key (secret!).
5. **Authentication → Providers → Email**: make sure Email is enabled. Turn **off** "Allow new users to sign up" (admins are added manually).
6. **Create the first admin login:**
   - **Authentication → Users → Add user → Create new user**: enter the organiser's email and a strong password, tick "Auto confirm".
   - Then in **SQL Editor** run (replace the email):
     ```sql
     insert into admin_users (user_id, email, name, role)
     select id, email, 'Organiser', 'admin' from auth.users where email = 'organiser@example.com';
     ```
   - For team members who should only edit content (not see payments or change prices), use `'editor'` instead of `'admin'`.
7. (For sponsor logos and route maps) **Storage → New bucket** called `public-assets`, set it to **Public**. Uploaded file links can be pasted into the admin area.

## 3. Razorpay (payments)
1. Create the account and complete business KYC. Until KYC is approved you can use **Test Mode**.
2. **Account & Settings → API Keys → Generate Key** (in Test Mode first). Copy the **Key ID** and **Key Secret**.
3. **Account & Settings → Payment capture**: set to **Automatic capture** (recommended).
4. Webhook (after Vercel is set up, step 5): **Account & Settings → Webhooks → Add new webhook**
   - URL: `https://YOUR-DOMAIN/api/webhooks/razorpay`
   - Secret: make up a long random string — this becomes `RAZORPAY_WEBHOOK_SECRET`
   - Events: `payment.captured`, `payment.failed`, `order.paid`
   - Do this once for Test Mode and again for Live Mode (they are separate).

## 4. Resend (email)
1. Create an account. **Domains → Add domain** → enter the website domain → add the DNS records it shows at your domain provider → wait for "Verified".
2. **API Keys → Create** and copy the key.
3. The "from" address must be on the verified domain, e.g. `Casa Atleta <hello@your-domain.in>`.

## 5. Vercel (website)
1. **Add New → Project → Import** the GitHub repository. Framework: Next.js (detected automatically).
2. Before the first deploy, open **Environment Variables** and add every variable from `.env.example`:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | `https://www.your-domain.in` |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service_role key (**secret**) |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | Razorpay Key ID (`rzp_test_…` first) |
| `RAZORPAY_KEY_SECRET` | Razorpay Key Secret (**secret**) |
| `RAZORPAY_WEBHOOK_SECRET` | The webhook secret you invented |
| `RESEND_API_KEY` | Resend API key (**secret**) |
| `EMAIL_FROM` | `Casa Atleta <hello@your-domain.in>` |
| `ORGANISER_EMAIL` | Where contact/partner enquiries go |
| `NEXT_PUBLIC_CONTACT_EMAIL` | Shown on the website |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | e.g. `+919876543210` |
| `NEXT_PUBLIC_INSTAGRAM_HANDLE` | e.g. `casaatleta` |
| `NEXT_PUBLIC_GA_ID` | Google Analytics 4 ID (optional) |

3. Click **Deploy**. Variables starting with `NEXT_PUBLIC_` are baked in at build time — after changing any of them, **redeploy**.
4. Region: **Settings → Functions → Region** → `bom1` (Mumbai) for speed.

## 6. Connect the domain
1. Vercel → Project → **Settings → Domains → Add** `your-domain.in` and `www.your-domain.in`.
2. Vercel shows DNS records (usually an **A record** `76.76.21.21` for the bare domain and a **CNAME** `cname.vercel-dns.com` for `www`). Add them at the company where the domain was bought (GoDaddy, Hostinger, etc.).
3. SSL (the padlock) is issued automatically once DNS is correct — allow up to a few hours.
4. Make sure `NEXT_PUBLIC_SITE_URL` matches the final address and redeploy.

## 7. Test before going live (Test Mode)
1. Sign in at `https://your-domain/admin/login`.
2. **Races & pricing**: set a fee (e.g. ₹10) and capacity for the 5K, set it to **Open**, save.
3. On the public site, register for the 5K. In the Razorpay window use a [Razorpay test card or test UPI ID](https://razorpay.com/docs/payments/payments/test-card-upi-details/).
4. Check: success screen shows a registration ID like `JCR-5K-000001`, the confirmation email arrives, and the participant appears in **Admin → Participants** as **Paid**.
5. Try a failed payment (Razorpay's failure test card) → the site shows "Payment didn't go through" and the admin list shows **Failed**.
6. Close the payment window without paying → "Payment not completed" with a retry button.
7. Set capacity to 1 and try registering twice → the second attempt says the race is full.
8. **Export CSV** from Participants and open it in Excel.
9. Send a contact message and a partnership enquiry → both appear in **Admin → Inbox** and arrive at `ORGANISER_EMAIL`.

## 8. Go live
1. When Razorpay KYC is approved: switch Razorpay to **Live Mode**, generate live keys, create the live webhook.
2. Replace `NEXT_PUBLIC_RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` and `RAZORPAY_WEBHOOK_SECRET` in Vercel with the live values → **Redeploy**.
3. In Supabase, delete test registrations: `delete from registrations;` (only before real registrations start!).
4. Have a lawyer review the legal pages in `src/app/(site)/legal/[slug]/page.tsx` and replace the draft text.
5. Set the real fees/capacities and open the races in admin.

## Backups, monitoring & security
- **Backups:** Supabase takes daily backups on paid plans. On the free plan, export weekly from **Database → Backups** or download the Participants CSV regularly. Upgrade to Supabase Pro before registrations open (recommended).
- **Errors:** Vercel → Project → **Logs** shows server errors. Razorpay → Webhooks shows delivery failures (the site safely handles retries).
- **Secrets:** never share the service_role key, Razorpay secret or Resend key, and never put them in the code. Rotate them if someone leaves the team.
- Card details never touch this website — Razorpay handles them.
- Participant data is protected by Supabase row-level security: only the website's server can read it.

## Updating the website later
Changes pushed to the `main` branch on GitHub deploy automatically on Vercel. Other branches get a private preview link.

## How payments work (for developers)
1. `POST /api/registrations` validates the form, then the database function `create_registration` locks the race row, checks status/capacity/duplicates and inserts a **pending** registration that holds the place for 30 minutes. A Razorpay order is created.
2. The browser opens Razorpay Checkout. On success it calls `POST /api/payments/verify`, which checks the signature **and** fetches the payment from Razorpay; only a `captured` payment marks the registration **paid** (`mark_registration_paid`, idempotent) and assigns the registration ID.
3. The webhook `POST /api/webhooks/razorpay` does the same server-to-server, so payments are recorded even if the runner closes the browser. Duplicate webhooks are ignored via `payment_events`.
4. The confirmation email is sent exactly once (`confirmation_sent_at`).
5. Edge case: if a bank confirms a payment *after* the 30-minute hold expired and the race filled meanwhile, the registration is still marked paid (the runner did pay); the admin can refund from Razorpay if needed.
