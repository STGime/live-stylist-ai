# Store listing assets

Source-of-truth copy for the App Store + Play Store listings.

## Files

- `short-description.txt` — Play Store short description (80 chars) and iOS subtitle (30 chars).
- `full-description.md` — long description for both stores. Same text works for both.
- `keywords.txt` — App Store keyword field. Play Store uses categories/tags, not keywords.
- `release-notes.md` — what's new for the first release.

## Visual assets (still TODO)

Drop into `app/assets/` and reference from `app.json`:

| File | Spec | Used for |
|---|---|---|
| `icon.png` | 1024×1024 PNG, no transparency, square | App icon (both stores) |
| `adaptive-icon.png` | 1024×1024 PNG, transparent foreground | Android adaptive icon |
| `splash.png` | 1242×2436 PNG, centered logo on dark | Launch splash |

Plus uploaded directly to App Store Connect / Play Console (not in repo):

| Asset | Spec | Min count |
|---|---|---|
| iPhone 6.7" screenshot | 1290×2796 PNG | 2 |
| iPhone 6.5" screenshot | 1242×2688 PNG | 2 |
| iPhone 5.5" screenshot | 1242×2208 PNG | 2 |
| Pixel 7 screenshot | 1080×2400 PNG | 2 |
| Pixel tablet screenshot | 1600×2560 PNG | 2 (if supporting tablets) |
| Play Store feature graphic | 1024×500 PNG, no text | 1 |
