# mixslidea

Website for a handmade wedding and celebration business: bridal accessories,
ceremony candles, florals, décor, cakes and cake toppers, for weddings,
Holy Communions, christenings and birthdays.

The business is shown like a shop with two named sections: a décor section
named for the owner's son, **Aiden’s Decor** (bridal accessories, ceremony
candles and crowns, bouquets, wedding and home décor) and a cakes section
named for her daughter, **Alita’s Cakes** (celebration cakes and toppers). The
names are set in `src/content.js` (`houses`).

It's a single page that tells one wedding day in five chapters, walking
through one section at a time:

- the night before (how the pieces are made), then a pair of doors to choose
  a section
- **Aiden’s Decor**: its sign is lowered on gold chains and swings to rest,
  then 9:00 the bride, 12:00 the ceremony and 16:00 the décor
- **Alita’s Cakes**: its own sign, then 20:00 the cake

With heavy motion:

- a loading screen that flicks through photos and lifts away; the opening
  headline bursts apart and its photos gather into Chapter I
- each chapter rises through its own window traced in gold wire: a chapel
  arch, a dressing-table mirror, a gothic window, an embroidery hoop and a
  cake plate
- the bride's pieces pass sideways, turning in 3D; candle columns run against
  each other and part like curtains; a wall of décor pulls back from a single
  wreath; a 3D ring of cakes turns as you scroll
- an endless, curved gallery you can drag and filter by section; tap a piece
  to see it full size and swipe between pieces
- a chapter indicator whose wire flower gains a petal per chapter, and an
  epilogue where the finished flower draws itself
- a "Keep scrolling" prompt that appears whenever a visitor stops partway

Visitors with "reduce motion" switched on get a calm version without the effects.

## Running it

Needs Node.js 20 or newer.

```sh
npm install
npm run dev      # local preview at http://localhost:5173
npm run build    # production files in dist/
```

`dist/` is plain static files and can go on any static host (Netlify, Vercel,
Cloudflare Pages, GitHub Pages).

## Admin panel and database

The admin panel is at `/admin/`. It signs in through Supabase, and only
people on the admin team get in. Its pages (in `src/admin/pages/`):

- **Dashboard**: new and open inquiries, payments due, products, recent
  changes, and a reminder when there are changes to publish
- **Inquiries**: each cake inquiry with its private photos, a WhatsApp reply
  button, status and notes; then the quote and the payments received
- **Products**: add, edit, hide, reorder and delete products in each section,
  with photos (resized to the site's two sizes and given the site's warm
  colour in the browser before uploading)
- **Gallery**: which pieces the story page's gallery shows, in what order
- **Cake options**: occasions, sizes, bases and frostings, with their prices
- **Site text**: every text on the story page and the two sections' signs,
  with photo pickers
- **Settings**: business name, WhatsApp, email, Instagram, UPI ID and QR code,
  search-engine title and description
- **Team** (owners): invite, change and remove admins
- **Publish**: rebuild the site with the latest content

## The cake order form

`/order/` lets customers design a cake: occasion, size, flavour and frosting
(from the admin panel's Cake options, with a running price estimate), a date,
up to five inspiration photos and their details. Every cake's page has
“Order a cake like this”, which starts the form from that cake.

Sending it (`server/inquiry.js`, run by the Functions in
`functions/api/inquiry/`):

1. the order is checked and saved, and the browser gets one-time links to
   upload the photos straight into the private `inquiry-uploads` bucket
2. the photos are recorded, the shop and the customer get an email (once),
   and WhatsApp opens with the whole order and links to the photos

It refuses bots (a hidden field, and Cloudflare Turnstile when set up), more
than three orders from one number in ten minutes, and requests from other
websites. New orders appear in the admin panel under Inquiries.

## Cloudflare settings

Under *Settings → Variables and secrets* of the Pages project:

| Name | Kind | What for |
|---|---|---|
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` | plain | the build and the Functions read the database |
| `SITE_URL` | plain | canonical links, sitemap and `robots.txt` (search engines are kept out until it's the shop's own domain, not `*.pages.dev`) |
| `NODE_VERSION` | plain | `22` |
| `DEPLOY_HOOK_URL` | secret | the admin panel's Publish button |
| `SUPABASE_SERVICE_KEY` | secret | orders and team invitations (server side only) |
| `RESEND_API_KEY`, `EMAIL_FROM` | secret, plain | order emails, e.g. `Alita’s Cakes <orders@yourdomain>` |
| `VITE_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET` | plain, secret | Cloudflare Turnstile on the order form (optional) |

The build writes `_headers` with strict security headers, allowing only the
site's own scripts (by fingerprint), Supabase and, when used, Turnstile.

A GitHub Action (`.github/workflows/keep-alive.yml`) reads one row from the
database every day, so Supabase's free plan never pauses the project.

The site is built from the database: pressing **Publish** rebuilds it with
the latest content (about a minute). Each section has its own page
(`/decor/`, `/cakes/`) and every product has one too (`/decor/<product>/`),
for search engines and for sharing.

The database (tables, security rules, photo storage) is in `supabase/`.
`supabase/README.md` explains who can do what and how to set up the hosted
project. Useful commands:

```sh
npm run content          # fetch content and photos from Supabase (or use src/content.js)
npm run db:seed-file     # rewrite supabase/seed.sql from src/content.js
npm run db:test          # check the security rules on a throwaway local Postgres
npm run db:upload-photos # once: put the site's photos into Supabase storage
```

To run the admin panel locally, copy `.env.example` to `.env.local` and fill
in the project's address and publishable key.

## Live site

**https://aidenstore.pages.dev** (the admin panel is at `/admin/`), hosted on
Cloudflare Pages (project `aidenstore` in the shop's Cloudflare account),
built from the `main` branch of `aidensstore1-star/aidenstore`. Every push to
`main`, and every press of Publish in the admin panel, rebuilds it with the
latest content from Supabase (about a minute). Its settings are listed under
*Cloudflare settings* below.

The old preview on `jeremygideonbareh.github.io/mixslidea` was an early copy
and no longer updates.

## Admin panel and database

The admin panel is at `/admin/`. It signs in through Supabase, and only
people on the admin team get in. Its pages (in `src/admin/pages/`):

- **Dashboard**: new and open inquiries, payments due, products, recent
  changes, and a reminder when there are changes to publish
- **Inquiries**: each cake inquiry with its private photos, a WhatsApp reply
  button, status and notes; then the quote and the payments received
- **Products**: add, edit, hide, reorder and delete products in each section,
  with photos (resized to the site's two sizes and given the site's warm
  colour in the browser before uploading)
- **Gallery**: which pieces the story page's gallery shows, in what order
- **Cake options**: occasions, sizes, bases and frostings, with their prices
- **Site text**: every text on the story page and the two sections' signs,
  with photo pickers
- **Settings**: business name, WhatsApp, email, Instagram, UPI ID and QR code,
  search-engine title and description
- **Team** (owners): invite, change and remove admins
- **Publish**: rebuild the site with the latest content

## The cake order form

`/order/` lets customers design a cake: occasion, size, flavour and frosting
(from the admin panel's Cake options, with a running price estimate), a date,
up to five inspiration photos and their details. Every cake's page has
“Order a cake like this”, which starts the form from that cake.

Sending it (`server/inquiry.js`, run by the Functions in
`functions/api/inquiry/`):

1. the order is checked and saved, and the browser gets one-time links to
   upload the photos straight into the private `inquiry-uploads` bucket
2. the photos are recorded, the shop and the customer get an email (once),
   and WhatsApp opens with the whole order and links to the photos

It refuses bots (a hidden field, and Cloudflare Turnstile when set up), more
than three orders from one number in ten minutes, and requests from other
websites. New orders appear in the admin panel under Inquiries.

## Cloudflare settings

Under *Settings → Variables and secrets* of the Pages project:

| Name | Kind | What for |
|---|---|---|
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` | plain | the build and the Functions read the database |
| `SITE_URL` | plain | canonical links, sitemap and `robots.txt` (search engines are kept out until it's the shop's own domain, not `*.pages.dev`) |
| `NODE_VERSION` | plain | `22` |
| `DEPLOY_HOOK_URL` | secret | the admin panel's Publish button |
| `SUPABASE_SERVICE_KEY` | secret | orders and team invitations (server side only) |
| `RESEND_API_KEY`, `EMAIL_FROM` | secret, plain | order emails, e.g. `Alita’s Cakes <orders@yourdomain>` |
| `VITE_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET` | plain, secret | Cloudflare Turnstile on the order form (optional) |

The build writes `_headers` with strict security headers, allowing only the
site's own scripts (by fingerprint), Supabase and, when used, Turnstile.

A GitHub Action (`.github/workflows/keep-alive.yml`) reads one row from the
database every day, so Supabase's free plan never pauses the project.

The site is built from the database: pressing **Publish** rebuilds it with
the latest content (about a minute). Each section has its own page
(`/decor/`, `/cakes/`) and every product has one too (`/decor/<product>/`),
for search engines and for sharing.

The database (tables, security rules, photo storage) is in `supabase/`.
`supabase/README.md` explains who can do what and how to set up the hosted
project. Useful commands:

```sh
npm run content          # fetch content and photos from Supabase (or use src/content.js)
npm run db:seed-file     # rewrite supabase/seed.sql from src/content.js
npm run db:test          # check the security rules on a throwaway local Postgres
npm run db:upload-photos # once: put the site's photos into Supabase storage
```

To run the admin panel locally, copy `.env.example` to `.env.local` and fill
in the project's address and publishable key.

## Preview link

The built site is published with GitHub Pages from the `gh-pages` branch:
https://jeremygideonbareh.github.io/mixslidea/

That branch holds only the files from `dist/` (and only the photos the page
uses), plus `.nojekyll` and a `robots.txt` that keeps the preview out of
search engines. To update it, build and replace the branch's contents with
the new `dist/`.

## Changing the content

- **Business name, contact details, wording and which photo goes where:**
  `src/content.js`
- **Photos:** original photos live in `images/`. Add a `.jpg` there and refer to
  it in `src/content.js` by its file name without `.jpg`. Web-sized copies are
  made automatically in `public/photos/` when you run `dev` or `build`.
- **Styles:** `src/styles/main.css`

### Still to fill in

- The business name (currently the placeholder "Atelier")
- WhatsApp number, email and Instagram handle (the buttons are placeholders
  until these are set)
- The draft wording, for the owner to check

Photos of cakes with customers' names written on them are kept in `images/`
but not used on the site until those customers agree.

## How it's built

[Vite](https://vite.dev), [GSAP](https://gsap.com) with ScrollTrigger and
SplitText, [Lenis](https://lenis.darkroom.engineering) for smooth scrolling and
[OGL](https://github.com/oframe/ogl) for WebGL. `scripts/render.mjs` turns
`src/content.js` into the page's HTML at build time.
