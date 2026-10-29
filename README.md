# mixslidea

Website for a handmade wedding and celebration business: bridal accessories,
ceremony candles, florals, décor, cakes and cake toppers, for weddings,
Holy Communions, christenings and birthdays.

It's a single page with heavy motion:

- a loading screen that flicks through photos and lifts away
- WebGL photos that ripple on hover and bend with scroll speed
- tumbling rose petals around the opening and closing sections
- a pinned section that scrolls sideways through the collections
- an endless, curved gallery you can drag; tap a piece to see it full size
- stacked cake cards, a cursor-following photo list, and smooth scrolling

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
