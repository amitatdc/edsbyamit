# Custom icon picker popup for the Universal Editor

A third option for choosing icons, parked for later. Two decisions are still open — see "Open decisions".

The two icon pickers that exist today are [`icon-picker-dropdown`](icon-picker-dropdown.md) and the asset picker on [`icon-list`](icon-list.md).

## How it works

The Universal Editor lets an extension replace the UI of a named data type. Registering `eba:icon-picker` and setting that as the field's `component` swaps the standard control for our iframe, which renders the icon grid.

```js
canvas: {
  getRenderers() {
    return [{ dataType: 'eba:icon-picker', url: '/index.html#/icon-picker' }];
  },
}
```

The iframe calls `attach()` from `@adobe/uix-guest` to read the current value and write the chosen icon back. Constraint from the [Adobe docs](https://developer.adobe.com/uix/docs/services/aem-universal-editor/api/custom-data-types/): the renderer URL must be same-origin as the extension that registered it.

Fork [adobe-rnd/uex-asset-picker](https://github.com/adobe-rnd/uex-asset-picker) rather than starting fresh — it is Adobe's Universal Editor custom asset picker and already wires up registration, `attach()`, and field write-back.

## Why this is attractive

If the picker stores the icon *name*, no block code changes: both blocks already resolve a bare name into an icon span.

```js
const name = cell.textContent.trim().toLowerCase();
if (!ICON_NAME.test(name)) return null;
const span = document.createElement('span');
span.className = `icon icon-${name}`;
```

That removes the DAM icon copy, [`tools/asset-selector/icon-picker.config.json`](../tools/asset-selector/icon-picker.config.json) and the Content Advisor extension from the picture, and makes the icon-colour limitation in [icon-list.md](icon-list.md) fixable, since a CSS mask needs the name at decoration time.

Cell budget is unaffected: one `icon` field replaces `image` + `imageMimeType` + `imageAlt`, so the item model stays under the `xwalk/max-cells` limit of four.

## Phase 1 — local prototype, no Adobe admin

1. Scaffold the extension (`aio app init`, Universal Editor Extension template with a custom renderer) or fork `uex-asset-picker`.
2. Register `eba:icon-picker` and build the grid: thumbnails, name search, clear-selection, current value highlighted.
3. Source the icon list from a manifest generated off `icons/`, reusing the scan in [`tools/icon-options/build-icon-options.mjs`](../tools/icon-options/build-icon-options.mjs).
4. Point the field at the new type in [`blocks/icon-list/_icon-list.json`](../blocks/icon-list/_icon-list.json), run `npm run build:json`.
5. Test with `?ext=https://localhost:9080` appended to the editor URL. Note the editor reads models from `main`, so the model change has to be merged to be visible.

## Phase 2 — make it permanent

Deploy with `aio app deploy` and enable it in Extension Manager, alongside the existing entries. Only then do authors get the picker without the query parameter.

## Open decisions

- Stored value: icon name (drops DAM entirely, no block changes) or DAM path (matches today's rendering).
- Whether to take Phase 2 at all, or keep the DAM picker for authors and treat this as a spike.

## Risks

- App Builder access and a Developer Console project are prerequisites for Phase 2.
- Adding an icon means rebuilding the extension if the manifest is bundled. Fetching it at runtime from the Edge Delivery site instead needs a CORS header for the extension's origin.
