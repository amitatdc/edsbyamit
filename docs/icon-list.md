# Icon picker: asset picker (Icon List block)

How to give authors a **visual pick-one-icon** experience in the Universal Editor, browsing thumbnails from a DAM folder, without writing a custom editor extension.

This is one of two working icon pickers in the project. The other is the [dropdown](iconpicker-dropdown.md), which needs no DAM and no environment setup, and a [custom popup grid](icon-picker-popup-plan.md) is sketched out as a future option. The comparison table in the [dropdown doc](iconpicker-dropdown.md#when-to-choose-this-one) covers the trade-off.

Local demo: http://localhost:3000/drafts/icon-list-demo

---

## How the picker works

The icon field opens the AEM asset selector, so authors browse icon **thumbnails**, search and click one — no file names to remember.

```
Author picks an SVG in the asset selector
                │
                ▼
    <picture><img src="…/download.svg"></picture>   (first cell)
                │
                ▼
    same markup, moved into the icon chip          (block JS)
```

The field is Adobe's [Custom Content Advisor](https://developer.adobe.com/uix/docs/extension-manager/extension-developed-by-adobe/configurable-asset-picker/), an extension published by Adobe and switched on in Extension Manager — there is no App Builder application to write or deploy. It is the standard asset selector plus a JSON configuration, which is what lets the picker be confined to the icons folder.

A plain `reference` field cannot be confined. `rootPath` validation is documented only for `aem-content` and the fragment pickers; the docs claim `reference` "offers an additional validation type" but list none, and setting `rootPath` on it was verified to do nothing — the selector still opens at **All Assets** and every folder stays browsable. Switching the field to `aem-content` would enforce a root, but its content picker is a path browser with no thumbnails, which defeats the point.

Universal Editor has no built-in icon-grid widget either. A true grid in the properties rail is possible through `canvas.getRenderers()`, which swaps a field's UI for your own iframe, but that does need an App Builder application.

The block also still accepts a decorated `span.icon` (the `:download:` shorthand typed in a document) or a bare icon name, so older content and document authoring keep working.

---

## Files

| File | Role |
| --- | --- |
| [`blocks/icon-list/icon-list.js`](../blocks/icon-list/icon-list.js) | `decorate(block)` — resolves the icon cell, builds the list |
| [`blocks/icon-list/icon-list.css`](../blocks/icon-list/icon-list.css) | Grid layout, icon chip, `boxed` / `compact` variants |
| [`blocks/icon-list/_icon-list.json`](../blocks/icon-list/_icon-list.json) | UE definitions, models, filter |
| [`tools/asset-selector/icon-picker.config.json`](../tools/asset-selector/icon-picker.config.json) | Content Advisor configuration — repository, root path, file-type filter |
| [`tools/icon-options/build-icon-options.mjs`](../tools/icon-options/build-icon-options.mjs) | Generates dropdown options from `icons/` — dormant, see "Going back to a dropdown" |
| [`models/_section.json`](../models/_section.json) | Allows `icon-list` in sections |
| [`icons/`](../icons/) | The icon set (24×24 SVG, `stroke="currentColor"`) |

Icons live in **two** places on purpose: `icons/` in the repository serves the `:name:` shorthand and other blocks, and `/content/dam/eba/icons` in AEM Assets backs the asset picker. Keep them in step.

---

## Building it yourself

**1. Add the fields.** Three fields make up the icon, and they collapse into a single cell:

```json
{
  "component": "custom-asset-namespace:custom-asset",
  "name": "image",
  "label": "Icon",
  "configUrl": "/content/dam/eba/icon-picker.config.json",
  "valueType": "string"
},
{
  "component": "custom-asset-namespace:custom-asset-mimetype",
  "name": "imageMimeType",
  "valueType": "string"
},
{
  "component": "text",
  "name": "imageAlt",
  "label": "Icon description",
  "valueType": "string",
  "value": ""
}
```

`imageMimeType` and `imageAlt` fold into `image` because `MimeType` and `Alt` are collapsible suffixes in `xwalk/max-cells`, so all three cost one cell of the four available.

**2. Write the config.** [`tools/asset-selector/icon-picker.config.json`](../tools/asset-selector/icon-picker.config.json) is what confines the picker. `rootPath` is the folder it opens in and cannot escape; `filterSchema` limits the file types offered.

**3. Take whatever the picker gives you.** The cell arrives as a `<picture>`, so the block reuses it rather than rebuilding it, and deliberately skips `createOptimizedPicture()` since webp and resize variants do not apply to SVG:

```js
const asset = cell.querySelector('picture, img');
if (asset) return asset.closest('picture') || asset;
```

**4. Allow the block in sections.** Add its id to the `section` filter in [`models/_section.json`](../models/_section.json), otherwise it never appears in the editor's component list.

**5. Do the environment setup below.** Unlike the dropdown, the code alone is not enough.

---

## Setting up the picker

1. Enable **Custom Content Advisor** in Extension Manager for the organisation. Until it is on, the field falls back to the ordinary asset selector, which opens at the DAM root.
2. Upload `tools/asset-selector/icon-picker.config.json` to `/content/dam/eba/icon-picker.config.json` — the path the `configUrl` in the model points at. Keep it out of the `icons` folder, or it appears in the picker as a selectable file.
3. Hard-refresh the Universal Editor so it re-fetches `component-models.json`.

Three things are easy to get wrong:

- **`repoNames` is environment-specific.** It lists the AEM author host, so each environment needs its own copy of the config.
- **The `imageMimeType` field is not optional.** It is what keeps delivery on the Edge Delivery Media Bus, which renders a `<picture>`. Without it the asset arrives as a Dynamic Media OpenAPI URL inside an anchor, which the block does not render as an icon. The field costs no cell: `MimeType`, like `Alt`, collapses into `image` under `xwalk/max-cells`.
- **Config failures are silent.** If the file cannot be fetched the picker still opens, simply unconfigured. Hosting the config on the EDS site instead — `https://main--edsbyamit--amitatdc.aem.page/tools/asset-selector/icon-picker.config.json` — works too, but then it must be served with `access-control-allow-origin: https://experience.adobe.com` or the browser blocks it as a cross-origin fetch.

The namespace in `custom-asset-namespace:custom-asset` is the extension's default and can be changed with its `asset-namespace` parameter.

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

The earlier version of this block used a select field listing the SVG names, generated from `icons/`. It cannot sit alongside the asset picker: `icon` is a name of its own, so it becomes a fifth cell and fails the `xwalk/max-cells` limit. JSON has no comments and `_icon-list.json` is machine-written, so the definition is kept here instead.

To revert, replace the `image`, `imageMimeType` and `imageAlt` fields in `blocks/icon-list/_icon-list.json` with this, then run `npm run build:json` — `build:icons` fills in the options and keeps them in step with the folder:

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
