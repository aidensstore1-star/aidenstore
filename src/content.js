// All words, contact details and photo choices for the site live here.
// Photo ids are file names from images/ without the .jpg extension. A photo's
// optional `focus` (CSS object-position) keeps the piece in view when cropped.

export const brand = {
  // TODO: replace with the business name once confirmed.
  name: 'Atelier',
  tagline: 'Handmade bridal accessories, ceremony candles, florals & cakes',
  // TODO: fill in. Leave empty to hide that contact button.
  whatsapp: '', // international format, digits only, e.g. 919800000000
  email: '',
  instagram: '', // handle without @
}

// The business runs as two named sections, like departments in a shop: the
// décor under her son's name and the cakes under her daughter's. Each
// section's chapters and photos are matched by `house` below.
// Placeholder names until the owner confirms them (the chat suggested
// "Aiden’s Decor" and "Anita’s Cakes"; check the spelling of her son's name).
// TODO: replace [Son] and [Daughter] with their names.
export const houses = {
  decor: {
    name: '[Son]’s Decor',
    short: 'Decor',
    namedFor: 'Named for our son',
    line: 'Bridal accessories, ceremony candles and crowns, bouquets and décor for the hall and the home, made in wire, pearl and flower.',
    sections: [
      { label: 'Bridal accessories', href: '#bride' },
      { label: 'Ceremony candles & crowns', href: '#ceremony' },
      { label: 'Wedding & home décor', href: '#home' },
    ],
    photo: 'hair-comb-pearl-crystal-ivory',
    // Shown around the section's sign as you walk in.
    sign: ['hair-vine-gold-leaves-pearls', 'tall-candle-silver-wire-flowers-pearls', 'triangle-wreath-gold-burgundy-ranunculus'],
    enquiry: 'Hello [Son]’s Decor! I’d love to ask about',
  },
  cakes: {
    name: '[Daughter]’s Cakes',
    short: 'Cakes',
    namedFor: 'Named for our daughter',
    line: 'Celebration cakes designed around your colours, finished with a topper made to match.',
    sections: [
      { label: 'Celebration cakes', href: '#celebration' },
      { label: 'Cake toppers', href: '#celebration' },
    ],
    photo: 'cake-pearl-wafer-sail-topper',
    sign: ['cake-white-wafer-strawberry-topper', 'cake-sheet-lilac-rosettes', 'cake-lion-one-month'],
    enquiry: 'Hello [Daughter]’s Cakes! I’d love to order',
  },
}

// Which house a photo belongs to: cakes are Anita's, everything else Aiden's.
export const houseOf = (id) => (photos[id]?.type === 'Cakes' ? 'cakes' : 'decor')

export const photos = {
  'hair-comb-pearl-crystal-ivory': { title: 'Pearl & crystal bridal comb', type: 'Bridal accessories', alt: 'Bridal hair comb with pearls, crystals and ivory wire leaves' },
  'hair-comb-pink-gold-wire-leaves': { title: 'Blush & gold leaf comb', type: 'Bridal accessories', alt: 'Hair comb with pink and gold wire leaves and pearls' },
  'hair-comb-red-wire-flowers-crystal': { title: 'Scarlet blossom comb', type: 'Bridal accessories', alt: 'Hair comb with red wire flowers and clear crystals' },
  'hair-comb-red-wire-flowers-wide': { title: 'Ruby wire-flower comb', type: 'Bridal accessories', alt: 'Wide hair comb covered in red wire flowers on gold wire' },
  'hair-vine-gold-leaves-pearls': { title: 'Golden leaf hair vine', type: 'Bridal accessories', alt: 'Gold wire leaf hair vine with pearls', focus: '50% 74%' },
  'crown-and-candle-lilac-set': { title: 'Lilac crown & candle set', type: 'Holy Communion', alt: 'Floral crown and matching candle with lilac ribbon' },
  'bouquet-white-calla-lily': { title: 'White calla lily bouquet', type: 'Bouquets & florals', alt: 'Bridal bouquet of white calla lilies, baby’s breath and eucalyptus' },
  'bouquet-red-ivory-peonies': { title: 'Red & ivory peony bouquet', type: 'Bouquets & florals', alt: 'Bridal bouquet of red and ivory peonies with berries', focus: '40% 50%' },
  'pomander-babys-breath-white-ribbon': { title: 'Baby’s breath pomander', type: 'Bouquets & florals', alt: 'Round pomander of baby’s breath with a white satin ribbon' },
  'flower-basket-burgundy-roses-gold': { title: 'Flower girl basket', type: 'Bouquets & florals', alt: 'Wicker flower basket with burgundy roses, lace and gold ribbon' },
  'tulle-garlands-burgundy-roses-with-basket': { title: 'Tulle garlands', type: 'Décor', alt: 'Ivory tulle garlands with burgundy roses and gold ribbon' },
  'hoop-wreath-gold-babys-breath': { title: 'Gold hoop wreath', type: 'Décor', alt: 'Gold hoop wreath with a cluster of white baby’s breath' },
  'hoop-wreath-wood-navy-blush-roses': { title: 'Navy & blush hoop', type: 'Décor', alt: 'Wooden hoop wreath with navy and blush roses' },
  'wood-tray-navy-blush-roses': { title: 'Floral wooden tray', type: 'Décor', alt: 'Wooden tray dressed with navy, blush and ivory roses' },
  'triangle-wreath-gold-burgundy-ranunculus': { title: 'Gold triangle wreath', type: 'Décor', alt: 'Gold triangle wreath with burgundy and blush ranunculus' },
  'triangle-wreaths-pair-gold-burgundy-ranunculus': { title: 'Triangle wreath pair', type: 'Décor', alt: 'Two gold triangle wreaths with burgundy and blush flowers' },
  'pillar-candle-ivory-coral-roses-front': { title: 'Coral rose pillar candle', type: 'Candles', alt: 'Ivory pillar candle with a peony and coral roses' },
  'pillar-candle-ivory-coral-roses-side': { title: 'Coral rose pillar candle', type: 'Candles', alt: 'Ivory pillar candle with burlap, lace and coral roses' },
  'pillar-candle-burlap-lace-flower-ring': { title: 'Garden ring candle', type: 'Candles', alt: 'Pillar candle with burlap and lace and a ring of yellow and pink flowers' },
  'pillar-candles-pair-red-roses-burlap': { title: 'Red rose candle pair', type: 'Candles', alt: 'Two pillar candles with red roses, burlap and gold leaves' },
  'pillar-candles-pair-pastel-lace': { title: 'Pastel lace candles', type: 'Candles', alt: 'Two pillar candles with lace, gold leaves and pastel flowers' },
  'pillar-candle-small-pastel-lace': { title: 'Pastel lace candle', type: 'Candles', alt: 'Small pillar candle with lace, berries and pastel flowers' },
  'tall-candle-silver-wire-flowers-pearls': { title: 'Silver blossom candle', type: 'Ceremony candles', alt: 'Tall candle covered in silver wire flowers and pearls' },
  'tall-candles-collection-four': { title: 'Ceremony candle collection', type: 'Ceremony candles', alt: 'Four tall ceremony candles in gold, ivory, pink and blue' },
  'tall-candle-ivory-roses-gold': { title: 'Ivory & gold candle', type: 'Ceremony candles', alt: 'Tall twisted candle with ivory roses and gold ribbon' },
  'tall-candle-pink-wire-flower-cluster': { title: 'Blush cluster candle', type: 'Ceremony candles', alt: 'Tall candle with a cluster of pink wire flowers and pearls' },
  'tall-candle-ombre-wire-flowers': { title: 'Ombré blossom candle', type: 'Ceremony candles', alt: 'Tall candle with pink, mauve and violet wire flowers' },
  'cake-pearl-wafer-sail-topper': { title: 'Pearl & wafer-sail cake', type: 'Cakes', alt: 'White cake with pearls, wafer-paper sails and a gold topper' },
  'cake-lilac-ombre-babys-breath': { title: 'Lilac ombré cake', type: 'Cakes', alt: 'White and lilac textured cake with a ring of baby’s breath' },
  'cake-blue-piped-flowers-lace': { title: 'Blue lace cake', type: 'Cakes', alt: 'Cake with hand-piped blue lace and buttercream flowers' },
  'cake-white-wafer-strawberry-topper': { title: 'Strawberry wafer cake', type: 'Cakes', alt: 'White cake with wafer-paper frills, a strawberry and a gold topper' },
  'cake-fresh-fruit-2': { title: 'Fresh fruit cake', type: 'Cakes', alt: 'Cream cake topped with kiwi, mango, pomegranate and cherries' },
  'cake-rainbow-wafer-paper': { title: 'Rainbow cake', type: 'Cakes', alt: 'White cake with a pastel rainbow and wafer-paper frills' },
  'cake-mocha-rosettes-topper': { title: 'Mocha rosette cake', type: 'Cakes', alt: 'Mocha cake with piped rosettes, chocolate chips and a gold topper' },
  'cake-mango-side-1': { title: 'Mango cream cake', type: 'Cakes', alt: 'White and yellow cake with mango pieces and piped cream' },
  'cake-coconut-yellow-flowers': { title: 'Coconut cake', type: 'Cakes', alt: 'Coconut-covered cake topped with yellow flowers' },
  'cake-lion-one-month': { title: 'Little lion cake', type: 'Cakes', alt: 'One-month celebration cake with a piped lion and clouds' },
  'cake-minimal-line-drawing': { title: 'Line-drawing cake', type: 'Cakes', alt: 'Minimal white cake with a piped line drawing and hearts' },
  'cake-sheet-lilac-rosettes': { title: 'Lilac rosette sheet cake', type: 'Cakes', alt: 'Rectangular cake bordered with lilac and teal rosettes and pearls' },
  'cake-blue-butterflies': { title: 'Butterfly cake', type: 'Cakes', alt: 'Pale blue cake with purple butterflies and silver stars' },
  'cake-mango-top-1': { title: 'Mango cream cake', type: 'Cakes', alt: 'Top of a white cake ringed with mango and yellow cream' },
  'cake-black-forest-side': { title: 'Black forest cake', type: 'Cakes', alt: 'Black forest cake with chocolate shards and cherries' },
}

// The five photos floating around the opening headline.
export const hero = [
  'bouquet-red-ivory-peonies',
  'pillar-candle-ivory-coral-roses-front',
  'tall-candle-silver-wire-flowers-pearls',
  'cake-pearl-wafer-sail-topper',
  'hoop-wreath-wood-navy-blush-roses',
]

// Photos that flick past on the loading screen.
export const preloader = [
  'hair-comb-pink-gold-wire-leaves',
  'bouquet-white-calla-lily',
  'crown-and-candle-lilac-set',
  'cake-lilac-ombre-babys-breath',
  'triangle-wreath-gold-burgundy-ranunculus',
  'tall-candle-ombre-wire-flowers',
]

// The story, in the order you scroll through it: the decor section's three
// chapters, then the cakes. `photo` is shown in the menu.
export const chapters = [
  { id: 'craft', num: 'I', title: 'The craft', photo: 'tall-candle-ombre-wire-flowers' },
  { id: 'bride', num: 'II', title: 'The bride', photo: 'hair-comb-pearl-crystal-ivory', house: 'decor' },
  { id: 'ceremony', num: 'III', title: 'The ceremony', photo: 'crown-and-candle-lilac-set', house: 'decor' },
  { id: 'home', num: 'IV', title: 'The décor', photo: 'hoop-wreath-wood-navy-blush-roses', house: 'decor' },
  { id: 'celebration', num: 'V', title: 'The cake', photo: 'cake-lilac-ombre-babys-breath', house: 'cakes' },
]

// Chapter I: one photo per beat, each with the line shown over it.
export const craft = {
  intro: ['It begins with', 'a single petal'],
  beats: [
    { photo: 'tall-candle-ombre-wire-flowers', line: ['Wire, bent', 'petal by petal'] },
    { photo: 'hair-vine-gold-leaves-pearls', line: ['Pearls, threaded', 'one by one'] },
    { photo: 'cake-blue-piped-flowers-lace', line: ['Cream, piped', 'to order'] },
  ],
}

export const statement = {
  text: 'Every comb, candle, crown and cake begins at our family’s table, in two sections named for our son and our daughter. This is one day, from the first pin in the bride’s hair to the last slice of cake.',
  photos: ['hair-comb-red-wire-flowers-wide', 'pillar-candle-burlap-lace-flower-ring'],
}

export const marquee = ['Bridal accessories', 'Ceremony candles', 'Bouquets & florals', 'Décor', 'Cakes & toppers']

export const bride = {
  title: ['Morning,', 'the bride'],
  text: 'The day begins with a comb pinned into place, a vine woven through the braid and a bouquet to hold.',
  // Closes the chapter, above the last piece.
  end: ['Made to match', 'the dress'],
  photos: [
    'hair-comb-pearl-crystal-ivory',
    'bouquet-white-calla-lily',
    'hair-comb-pink-gold-wire-leaves',
    'pomander-babys-breath-white-ribbon',
    'hair-comb-red-wire-flowers-crystal',
    'flower-basket-burgundy-roses-gold',
    'hair-comb-red-wire-flowers-wide',
  ],
  // The morning, told in passing: a line above some of the pieces.
  moments: {
    0: ['8:10', 'Pearls pinned in, one by one'],
    1: ['8:40', 'Lilies to hold'],
    3: ['9:15', 'A pomander for the flower girl'],
    5: ['9:40', 'Petals for the aisle'],
  },
}

export const ceremony = {
  title: ['Noon,', 'the ceremony'],
  text: 'At the altar: Holy Communion and christening candles dressed in wire flowers and pearls, and a crown of flowers for a small head.',
  // Every candle once, in the order they are shared across the columns.
  photos: [
    'tall-candle-silver-wire-flowers-pearls',
    'tall-candles-collection-four',
    'tall-candle-ivory-roses-gold',
    'pillar-candle-ivory-coral-roses-front',
    'tall-candle-ombre-wire-flowers',
    'pillar-candle-small-pastel-lace',
    'tall-candle-pink-wire-flower-cluster',
    'pillar-candles-pair-pastel-lace',
    'pillar-candle-ivory-coral-roses-side',
    'pillar-candles-pair-red-roses-burlap',
    'pillar-candle-burlap-lace-flower-ring',
  ],
  // Revealed full-screen when the columns part.
  finale: 'crown-and-candle-lilac-set',
}

export const celebration = {
  title: ['Evening,', 'the cake'],
  text: 'And as the evening begins, the cake: in your colours, finished with a topper to match. For weddings, birthdays, christenings, communions and showers.',
  tags: ['Birthdays', 'Christenings', 'Communions', 'Baby showers', 'Weddings', 'Custom toppers'],
  ring: [
    'cake-pearl-wafer-sail-topper',
    'cake-lilac-ombre-babys-breath',
    'cake-white-wafer-strawberry-topper',
    'cake-fresh-fruit-2',
    'cake-rainbow-wafer-paper',
    'cake-mocha-rosettes-topper',
    'cake-mango-side-1',
    'cake-coconut-yellow-flowers',
    'cake-blue-butterflies',
    'cake-lion-one-month',
    'cake-minimal-line-drawing',
    'cake-blue-piped-flowers-lace',
  ],
}

export const home = {
  title: ['Afternoon,', 'the décor'],
  text: 'By afternoon the hall is dressed: hoops on the doors, garlands on the chairs, a tray for the rings. And when the day is over, every piece goes home with you.',
  // A wall of nine, read left to right, top to bottom. The middle one (5th)
  // opens the chapter full-screen before the wall pulls back.
  wall: [
    'triangle-wreaths-pair-gold-burgundy-ranunculus',
    'hoop-wreath-gold-babys-breath',
    'pillar-candle-burlap-lace-flower-ring',
    'wood-tray-navy-blush-roses',
    'hoop-wreath-wood-navy-blush-roses',
    'tulle-garlands-burgundy-roses-with-basket',
    'bouquet-red-ivory-peonies',
    'triangle-wreath-gold-burgundy-ranunculus',
    'pillar-candles-pair-red-roses-burlap',
  ],
}

// The endless, draggable gallery.
export const gallery = [
  'hair-comb-pink-gold-wire-leaves',
  'bouquet-white-calla-lily',
  'pillar-candle-burlap-lace-flower-ring',
  'cake-coconut-yellow-flowers',
  'hair-comb-red-wire-flowers-crystal',
  'flower-basket-burgundy-roses-gold',
  'tall-candle-ombre-wire-flowers',
  'cake-lion-one-month',
  'hoop-wreath-gold-babys-breath',
  'pillar-candles-pair-red-roses-burlap',
  'hair-vine-gold-leaves-pearls',
  'cake-blue-butterflies',
  'pomander-babys-breath-white-ribbon',
  'wood-tray-navy-blush-roses',
  'tulle-garlands-burgundy-roses-with-basket',
  'cake-minimal-line-drawing',
  'triangle-wreath-gold-burgundy-ranunculus',
  'pillar-candle-small-pastel-lace',
  'cake-sheet-lilac-rosettes',
  'hair-comb-red-wire-flowers-wide',
  'cake-mango-top-1',
  'pillar-candle-ivory-coral-roses-front',
]

export const process = [
  { title: 'Share your day', text: 'The date, your colours, the feeling you want, or a photo of something you love.', photo: 'bouquet-white-calla-lily' },
  { title: 'Design it together', text: 'Choose from past pieces or start something new. Every detail can be changed.', photo: 'hair-comb-pink-gold-wire-leaves' },
  { title: 'Made by hand', text: 'Shaped, piped, threaded and finished by hand, ready for your celebration.', photo: 'tall-candle-pink-wire-flower-cluster' },
]
