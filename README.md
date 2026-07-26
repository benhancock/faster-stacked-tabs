# Faster Stacked Tabs

Speed up switching between stacked tabs while keeping the horizontal sliding
animation.

The core stacked-tabs feature uses the browser's native smooth scrolling, whose
duration is not configurable. Faster Stacked Tabs replaces only that horizontal
scroll with a shorter, adjustable ease-out animation.

## Features

- Keeps the stacked-tab sliding animation instead of disabling it.
- Adjustable duration from 40–400 ms, with a 120 ms default.
- Leaves regular tabs and scrolling elsewhere unchanged.
- Restores native scrolling when the plugin is disabled.

## Usage

1. Enable **Faster Stacked Tabs** under **Settings → Community plugins**.
2. Open **Settings → Faster Stacked Tabs**.
3. Set **Animation duration** to the speed you prefer. The default is 120 ms.

The plugin only changes smooth horizontal scrolling inside stacked tab groups.
Normal tabs and scrolling elsewhere are left unchanged.

## Installation from source

```bash
npm install
npm run build
```

Copy `manifest.json` and `main.js` into:

```text
<vault>/.obsidian/plugins/faster-stacked-tabs/
```

Reload the app, then enable the plugin under **Settings → Community plugins**.

## Privacy

Faster Stacked Tabs does not access note contents, make network requests, or
collect analytics. Its only saved value is the selected animation duration.

## Development

```bash
npm install
npm run lint
npm run typecheck
npm run build
```

## License

[MIT](LICENSE)
