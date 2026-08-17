# Icon picker: dropdown

How to give authors a pick-one-icon field in the Universal Editor using nothing but a `select` field whose options are generated from the project's own SVG folder.

This is one of two working icon pickers in the project. The other is the [asset picker](icon-list.md), and a [custom popup grid](icon-picker-popup-plan.md) is sketched out as a future option.

Local demo: http://localhost:3000/drafts/iconpicker-dropdown-demo

---

## When to choose this one

| | Dropdown | [Asset picker](icon-list.md) |
| --- | --- | --- |
| Author sees | Icon names in a list | Icon thumbnails |
| Icons live in | `icons/` in the repository | `icons/` **and** AEM Assets |
| Setup outside the repo | None | Extension enabled, config uploaded, icons published |
| Adding an icon | Add the SVG, `npm run build:json` | The above, plus upload and publish to the DAM |
| Value stored | `download` | `/content/dam/eba/icons/download.svg` |

The dropdown is entirely self-contained: no DAM, no extension, no environment configuration. Its one real weakness is that authors read names rather than seeing the icon, which stops scaling somewhere around thirty or forty icons.

---

## How it works

```
Author picks "download" in the dropdown
                │
                ▼
    download                                       (first cell of the row)
                │
                ▼
    <span class="icon icon-download">              (block JS)
                │
                ▼
    <img src="/icons/download.svg">                (decorateIcons from aem.js)
```

The block never fetches anything itself. It converts the authored name into the icon span that `decorateIcons()` already knows how to expand, which is the same markup the `:download:` shorthand produces in a document. That is why document authoring and the editor produce identical output.

---

## Building it yourself

**1. Add the field.** In `blocks/<name>/_<name>.json`, give the item model a `select` field named exactly `icon`, with one placeholder option:

```json
{
  "component": "select",
  "name": "icon",
  "label": "Icon",
  "description": "Icons are the SVG files in the project /icons folder",
  "valueType": "string",
  "value": "",
  "options": [
    { "name": "No icon", "value": "" }
  ]
}
```

The name matters. [`tools/icon-options/build-icon-options.mjs`](../tools/icon-options/build-icon-options.mjs) looks for `component: "select"` with `name: "icon"` in every `blocks/*/_*.json`, so any block that follows this shape gets its options filled in automatically:

```js
if (field.component === 'select' && field.name === 'icon') {
  field.options = options;
  updated = true;
}
```

**2. Generate the options.** `npm run build:json` runs `build:icons` first, so one command scans `icons/`, rewrites the model, and regenerates the aggregate files. Never hand-edit the options — they are overwritten.

**3. Resolve the name in the block.** Accept an already-decorated span first, so document authoring keeps working, then fall back to a bare name:

```js
function toIconSpan(cell) {
  const authored = cell.querySelector('span.icon');
  if (authored) return authored;

  const name = cell.textContent.trim().toLowerCase();
  if (!ICON_NAME.test(name)) return null;

  const span = document.createElement('span');
  span.className = `icon icon-${name}`;
  return span;
}
```

The regex guard is what makes an empty or unexpected cell degrade quietly instead of producing `icon-`.

**4. Call `decorateIcons`.** After building the DOM, `decorateIcons(block)` turns every span into an `<img>` pointing at `/icons/<name>.svg`.

**5. Allow the block in sections.** Add its id to the `section` filter in [`models/_section.json`](../models/_section.json), otherwise it never appears in the editor's component list.

---

## Files

| File | Role |
| --- | --- |
| [`blocks/iconpicker-dropdown/iconpicker-dropdown.js`](../blocks/iconpicker-dropdown/iconpicker-dropdown.js) | `decorate(block)` — resolves the icon cell, builds the list |
| [`blocks/iconpicker-dropdown/iconpicker-dropdown.css`](../blocks/iconpicker-dropdown/iconpicker-dropdown.css) | Grid layout, icon chip, `boxed` / `compact` variants |
| [`blocks/iconpicker-dropdown/_iconpicker-dropdown.json`](../blocks/iconpicker-dropdown/_iconpicker-dropdown.json) | UE definitions, models, filter |
| [`tools/icon-options/build-icon-options.mjs`](../tools/icon-options/build-icon-options.mjs) | Fills the dropdown options from `icons/` |
| [`icons/`](../icons/) | The icon set (24×24 SVG, `stroke="currentColor"`) |

---

## Author contract (initial HTML)

One row per item, four cells:

| Icon Picker Dropdown (boxed) |
| --- | --- | --- | --- |
| `download` | `<h3>Downloads</h3>` | Description paragraph | Link |

- **Icon** — chosen from the dropdown, stored as the bare file name
- **Title** — heading level chosen with the Title Type field (default `h3`)
- **Text** — rich text description
- **Link** — page link plus link text

Every cell is optional. A missing icon renders the item without the chip, and a name with no matching SVG has its chip removed rather than showing a broken image.

**Variants** (multiselect on the block): `boxed` (bordered cards), `compact` (icon beside the text).

---

## Adding an icon

1. Add an optimized SVG to [`icons/`](../icons/). Use a 24×24 viewBox and `stroke="currentColor"`.
2. Run `npm run build:json`.
3. Commit the SVG and the regenerated JSON.

That is the whole loop — nothing to upload or publish.

---

## Known limitation: icon colour

An SVG loaded through `<img>` cannot inherit `currentColor`, so icons render in their own colour on the sage chip. Unlike the asset picker, this block *can* be fixed with a CSS mask, because the icon name — and therefore the URL — is known at decoration time:

```css
main .iconpicker-dropdown .iconpicker-dropdown-icon .icon {
  background-color: currentColor;
  mask: var(--icon-url) center / contain no-repeat;
}
```

with the block JS setting `--icon-url` to `/icons/<name>.svg`.
