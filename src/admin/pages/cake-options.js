import { supabase } from '../supabase.js'
import { attempt, fill, h, moveButtons, must, switchInput, toast } from '../ui.js'

// The choices on the cake inquiry form, each with the price it adds.

const KINDS = [
  ['occasion', 'Occasions'],
  ['size', 'Sizes'],
  ['base', 'Bases (cake flavours)'],
  ['frosting', 'Frostings'],
]

export async function cakeOptions(content) {
  fill(content, h('h1', 'Cake options'), h('p.muted', 'Loading…'))
  let options = []
  if (!(await attempt(async () => (options = must(await supabase.from('cake_options').select('*').order('kind').order('sort')))))) return

  const groups = h('div.groups')

  const draw = () => {
    fill(groups,
      ...KINDS.map(([kind, label]) => {
        const rows = options.filter((o) => o.kind === kind)
        return h(
          'section.box',
          h('h2', label),
          h(
            'ul.rows.rows--compact',
            rows.map((o, i) =>
              h(
                'li.row.row--option',
                h('input.row__input', {
                  value: o.label,
                  maxlength: 80,
                  'aria-label': 'Name',
                  onchange: (e) => save(o, { label: e.target.value.trim() }, e.target),
                }),
                h(
                  'label.price',
                  h('span', '+ ₹'),
                  h('input', {
                    type: 'number',
                    step: 1,
                    value: Number(o.price_delta),
                    'aria-label': `Price added for ${o.label}`,
                    onchange: (e) => save(o, { price_delta: Number(e.target.value || 0) }, e.target),
                  }),
                ),
                switchInput(o.is_active, (on) => save(o, { is_active: on }), 'Offered'),
                moveButtons(() => move(rows, i, -1), () => move(rows, i, 1), { first: i === 0, last: i === rows.length - 1 }),
                h('button.icon', { type: 'button', 'aria-label': `Delete ${o.label}`, title: 'Delete', onclick: () => remove(o) }, '×'),
              ),
            ),
          ),
          h(
            'form.add',
            {
              onsubmit: (e) => {
                e.preventDefault()
                const input = e.target.elements.label
                if (input.value.trim()) add(kind, input.value.trim())
              },
            },
            h('input', { name: 'label', maxlength: 80, placeholder: `Add to ${label.toLowerCase()}`, 'aria-label': `New ${kind}` }),
            h('button.btn.btn--quiet', { type: 'submit' }, 'Add'),
          ),
        )
      }),
    )
  }

  async function save(o, change, input) {
    if ('label' in change && !change.label) {
      toast('The name can’t be empty.', 'bad')
      input.value = o.label
      return
    }
    const ok = await attempt(async () => must(await supabase.from('cake_options').update(change).eq('id', o.id)), 'Saved')
    if (ok) Object.assign(o, change)
    else if (input) input.value = o[Object.keys(change)[0]]
    if (!input) draw()
  }

  // The list moves at once; the new positions are saved behind it.
  async function move(rows, i, dir) {
    ;[rows[i], rows[i + dir]] = [rows[i + dir], rows[i]]
    const changed = rows.filter((o, n) => o.sort !== n)
    rows.forEach((o, n) => (o.sort = n))
    options.sort((a, b) => (a.kind === b.kind ? a.sort - b.sort : a.kind.localeCompare(b.kind)))
    draw()
    const ok = await attempt(async () => {
      ;(await Promise.all(changed.map((o) => supabase.from('cake_options').update({ sort: o.sort }).eq('id', o.id)))).forEach(must)
    })
    if (!ok) cakeOptions(content)
  }

  async function add(kind, label) {
    const sort = Math.max(-1, ...options.filter((o) => o.kind === kind).map((o) => o.sort)) + 1
    await attempt(async () => options.push(must(await supabase.from('cake_options').insert({ kind, label, sort }).select('*').single())), 'Added')
    draw()
  }

  async function remove(o) {
    if (!confirm(`Delete “${o.label}”? Past inquiries keep what the customer chose. (To stop offering it for now, switch “Offered” off instead.)`)) return
    if (await attempt(async () => must(await supabase.from('cake_options').delete().eq('id', o.id)), 'Deleted')) options = options.filter((x) => x !== o)
    draw()
  }

  fill(content,
    h('h1', 'Cake options'),
    h('p', 'What customers choose from on the cake inquiry form. The price is what each choice adds to the cake’s starting price; leave it at 0 if it doesn’t change the price.'),
    groups,
    h('p.muted.small', 'Changes are saved as you type, and show on the website after you publish.'),
  )
  draw()
}
