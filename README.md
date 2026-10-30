# mixslidea

Website for a handmade wedding and celebration business: bridal accessories,
ceremony candles, florals, décor, cakes and cake toppers, for weddings,
Holy Communions, christenings and birthdays.

The business is shown as two named sections, like departments in a shop:
**Aiden’s Decor** (bridal accessories, ceremony candles and crowns, bouquets,
home décor) and **Anita’s Cakes** (celebration cakes and toppers). The names
are set in `src/content.js` (`houses`) and are still to be confirmed.

It's a single page that tells one wedding day in five chapters (the night
before, 9:00 the bride, 12:00 the ceremony, 16:00 the celebration, 21:00 the
home), with heavy motion:

- a loading screen that flicks through photos and lifts away; the opening
  headline bursts apart and its photos gather into Chapter I
- each chapter rises through its own window traced in gold wire: a chapel
  arch, a gothic window, a cake-plate iris and an embroidery hoop
- the bride's pieces pass sideways, turning in 3D; candle columns run against
  each other and part like curtains; a 3D ring of cakes turns as you scroll;
  a wall of home pieces pulls back from a single wreath
- an endless, curved gallery you can drag and filter by house; tap a piece to
  see it full size and swipe between pieces
- a chapter indicator whose wire flower gains a petal per chapter, and an
  epilogue where the finished flower draws itself

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

## Changing the content

- **Business name, contact details, wording and which photo goes where:**
  `src/content.js`
- **Photos:** original photos live in `images/`. Add a `.jpg` there and refer to
  it in `src/content.js` by its file name without `.jpg`. Web-sized copies are
  made automatically in `public/photos/` when you run `dev` or `build`.
- **Styles:** `src/styles/main.css`

### Still to fill in

- The business name (currently the placeholder "Atelier") and the two
  section names (Aiden’s Decor, Anita’s Cakes)
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
