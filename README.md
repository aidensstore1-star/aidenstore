# mixslidea

Website for a handmade wedding and celebration business: bridal accessories,
ceremony candles, florals, décor, cakes and cake toppers, for weddings,
Holy Communions, christenings and birthdays.

The business is shown like a shop with two named sections: **Aiden’s Decor**,
named for the owner's son (bridal accessories, ceremony candles and crowns,
bouquets, wedding and home décor) and **Anita’s Cakes**, named for her daughter
(celebration cakes and toppers). The names are set in `src/content.js`
(`houses`) and are still to be confirmed.

It's a single page that tells one wedding day in five chapters, walking
through one section at a time:

- the night before (how the pieces are made), then a pair of doors to choose
  a section
- **Aiden’s Decor**: its sign is lowered on gold chains and swings to rest,
  then 9:00 the bride, 12:00 the ceremony and 16:00 the décor
- **Anita’s Cakes**: its own sign, then 20:00 the cake

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
  section names (Aiden’s Decor, Anita’s Cakes), including the spelling of her
  son's name (written both "Aiden" and "Adien" in the chat)
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
