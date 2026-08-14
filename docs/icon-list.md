# Icon List block — icon picker for authors

How this project gives authors a **pick one icon from a list** experience, using the standard Edge Delivery icon convention instead of a custom editor widget.

Local demo: http://localhost:3000/drafts/icon-list-demo

---

## How the picker works

Universal Editor has no built-in icon-grid widget, so the picker is a **select field whose options are the SVG files in [`icons/`](../icons/)**. The author chooses a name, the block turns that name into `<span class="icon icon-<name>">`, and `decorateIcons()` from [`scripts/aem.js`](../scripts/aem.js) swaps in `<img src="/icons/<name>.svg">`.

```
Author picks "Download"  →  cell value "download"
                              │
                              ▼
        <span class="icon icon-download">   (block JS)
                              │
                              ▼
        <img src="/icons/download.svg">     (decorateIcons)
```

The same block also accepts an icon that is already decorated, so the `:download:` shorthand typed in a document works without any extra code.

---

## Files

| File | Role |
| --- | --- |
| [`blocks/icon-list/icon-list.js`](../blocks/icon-list/icon-list.js) | `decorate(block)` — resolves the icon cell, builds the list |
| [`blocks/icon-list/icon-list.css`](../blocks/icon-list/icon-list.css) | Grid layout, icon chip, `boxed` / `compact` variants |
| [`blocks/icon-list/_icon-list.json`](../blocks/icon-list/_icon-list.json) | UE definitions, models, filter — contains the icon options |
| [`tools/icon-options/build-icon-options.mjs`](../tools/icon-options/build-icon-options.mjs) | Regenerates the icon options from `icons/` |
| [`models/_section.json`](../models/_section.json) | Allows `icon-list` in sections |
| [`icons/`](../icons/) | The icon set (24×24 SVG, `stroke="currentColor"`) |

---

## Author contract (initial HTML)

One row per item, four cells:

| Icon List (boxed) |
| --- | --- | --- | --- |
| `download` | `<h3>Downloads</h3>` | Description paragraph | Link |

- **Icon** — icon name, or empty for no icon
- **Title** — heading level chosen with the Title Type field (default `h3`)
- **Text** — rich text description
- **Link** — page link plus link text

Every cell is optional. A missing icon renders the item without the chip, and an icon name with no matching SVG is removed rather than shown as a broken image.

**Variants** (multiselect on the block): `boxed` (bordered cards), `compact` (icon beside the text).

---

## Adding an icon

1. Drop an optimized SVG into [`icons/`](../icons/). Use a 24×24 viewBox and `stroke="currentColor"` so the icon can be recoloured if it is ever inlined.
2. Regenerate the picker options and the UE aggregates:

```bash
npm run build:json
```

`build:json` runs `build:icons` first, which rewrites the options of **every** `icon` select field in `blocks/*/_*.json` from the folder listing. The dropdown can therefore never drift from the icons the site ships — never hand-edit those options.

3. Commit the SVG and the regenerated `component-*.json` files.

---

## Sample page

Sample content is **not** kept in this repository. A ready-to-install FileVault package (`eba-icon-list.zip`) is supplied separately and creates one page, `/content/eba/examples/icon-list`, showing all three variants.

1. AEM **Tools → Deployment → Packages → Upload Package**, then **Install**
2. Open Sites → `examples` → `Icon list` → **Edit** to check the icon dropdown
3. **Publish** the page

Its workspace filter merges on `/content/eba/examples` and replaces only the sample page, so reinstalling it leaves the rest of the tree alone. Once published the page is served at `/examples/icon-list` on the preview and live hosts.

For local work, any page using the block can be previewed with `aem up --html-folder drafts`.

---

## Known limitation: icon colour

`decorateIcons()` renders icons as `<img>`, and an external SVG in an `<img>` cannot inherit `currentColor` from the page. The icons therefore render in their own default colour (black) on the sage chip.

If per-theme icon colour becomes a requirement, switch the chip to a CSS mask:

```css
main .icon-list .icon-list-icon .icon {
  background-color: currentColor;
  mask: var(--icon-url) center / contain no-repeat;
}
```

with the block JS setting `--icon-url` to the SVG path and skipping `decorateIcons()`.
