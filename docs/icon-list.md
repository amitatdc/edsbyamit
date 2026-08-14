# Icon List block — icon picker for authors

How this project gives authors a **visual pick-one-icon** experience in the Universal Editor, without a custom editor extension.

Local demo: http://localhost:3000/drafts/icon-list-demo

---

## How the picker works

The icon field is a `reference` (AEM asset picker) pointing at a DAM folder of SVGs. Clicking it opens the asset selector, so authors browse icon **thumbnails**, search and click one — no file names to remember.

```
Author picks an SVG in the asset selector
                │
                ▼
    <picture><img src="…/download.svg"></picture>   (first cell)
                │
                ▼
    same markup, moved into the icon chip          (block JS)
```

Universal Editor has no built-in icon-grid widget. A visual grid inside the properties rail is possible — UE's `canvas.getRenderers()` extension point replaces a field's UI with your own iframe, matched on the `component` value in the model — but it requires an Adobe App Builder application with its own deployment and Extension Manager registration. The asset picker gives most of that benefit for none of that cost.

The block also still accepts a decorated `span.icon` (the `:download:` shorthand typed in a document) or a bare icon name, so older content and document authoring keep working.

---

## Files

| File | Role |
| --- | --- |
| [`blocks/icon-list/icon-list.js`](../blocks/icon-list/icon-list.js) | `decorate(block)` — resolves the icon cell, builds the list |
| [`blocks/icon-list/icon-list.css`](../blocks/icon-list/icon-list.css) | Grid layout, icon chip, `boxed` / `compact` variants |
| [`blocks/icon-list/_icon-list.json`](../blocks/icon-list/_icon-list.json) | UE definitions, models, filter |
| [`tools/icon-options/build-icon-options.mjs`](../tools/icon-options/build-icon-options.mjs) | Generates dropdown options from `icons/` — dormant, see "Going back to a dropdown" |
| [`models/_section.json`](../models/_section.json) | Allows `icon-list` in sections |
| [`icons/`](../icons/) | The icon set (24×24 SVG, `stroke="currentColor"`) |

Icons live in **two** places on purpose: `icons/` in the repository serves the `:name:` shorthand and other blocks, and `/content/dam/eba/icons` in AEM Assets backs the asset picker. Keep them in step.

---

## Author contract (initial HTML)

One row per item, four cells:

| Icon List (boxed) |
| --- | --- | --- | --- |
| Icon SVG | `<h3>Downloads</h3>` | Description paragraph | Link |

- **Icon** — an SVG from `/content/dam/eba/icons`, plus an optional description (leave empty when decorative)
- **Title** — heading level chosen with the Title Type field (default `h3`)
- **Text** — rich text description
- **Link** — page link plus link text

Every cell is optional. A missing icon renders the item without the chip, and an icon that fails to load — an unpublished asset, or a name with no matching SVG — has its chip removed rather than showing a broken image.

**Variants** (multiselect on the block): `boxed` (bordered cards), `compact` (icon beside the text).

---

## Adding an icon

1. Add an optimized SVG to [`icons/`](../icons/). Use a 24×24 viewBox and `stroke="currentColor"` so the icon can be recoloured if it is ever inlined.
2. Upload the same file to `/content/dam/eba/icons` in AEM Assets and **publish** it. An unpublished icon is a missing icon on the live site.
3. Commit the SVG.

`createOptimizedPicture()` is deliberately not applied to these images — the webp and resize variants it requests do not apply to SVG.

---

## Sample page

Sample content is **not** kept in this repository. A ready-to-install FileVault package (`eba-icon-list.zip`) is supplied separately and creates one page, `/content/eba/examples/icon-list`, showing all three variants.

1. Upload the `icons/` SVGs to `/content/dam/eba/icons` in AEM Assets
2. AEM **Tools → Deployment → Packages → Upload Package**, then **Install**
3. Open Sites → `examples` → `Icon list` → **Edit** to check the asset picker
4. **Publish** the icons folder and the page

Its workspace filter merges on `/content/eba/examples` and replaces only the sample page, so reinstalling it leaves the rest of the tree alone. Once published the page is served at `/examples/icon-list` on the preview and live hosts.

For local work, any page using the block can be previewed with `aem up --html-folder drafts`.

---

## Going back to a dropdown

The earlier version of this block used a select field listing the SVG names, generated from `icons/`. It cannot sit alongside the asset picker: the item model is already at the four-cell ceiling enforced by `xwalk/max-cells`, and a fifth field fails lint. JSON has no comments and `_icon-list.json` is machine-written, so the definition is kept here instead.

To revert, replace the `image` and `imageAlt` fields in `blocks/icon-list/_icon-list.json` with this, then run `npm run build:json` — `build:icons` fills in the options and keeps them in step with the folder:

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

The block JS needs no change — it already resolves a bare icon name into `<span class="icon icon-<name>">`.

---

## Known limitation: icon colour

An external SVG loaded through `<img>` cannot inherit `currentColor` from the page, whether it comes from DAM or from `icons/`. The icons therefore render in their own colour on the sage chip.

If per-theme icon colour becomes a requirement, switch the chip to a CSS mask:

```css
main .icon-list .icon-list-icon .icon {
  background-color: currentColor;
  mask: var(--icon-url) center / contain no-repeat;
}
```

with the block JS setting `--icon-url` to the SVG path. That only works for repository icons, since the mask URL must be known at decoration time.
