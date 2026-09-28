# Wardrobe AI

Your closet, organized. A 100% local closet organizer, outfit builder, and "what should I wear?" assistant — no accounts, no cloud, no API keys.

## What it does

- **Closet** — add clothing items with category, color, seasons, occasions, and an optional photo (auto-resized to stay small)
- **Outfit builder** — pick pieces into a draft and save named outfits
- **What to wear** — enter weather + occasion and get a suggested outfit from your actual closet, with completeness checks and missing-piece notes
- **Donate & sell piles** — move pieces out of the closet without deleting them; re-keep or remove anytime

## Smart suggestions

- Filters by weather-to-season mapping (hot → summer pieces, cold → winter layers)
- Adds outerwear automatically in cold weather
- Prefers dresses as complete looks over separates
- Scores matches by occasion + weather fit

## Run it

Open `index.html` in any modern browser. Everything persists in `localStorage` — your wardrobe never leaves this device.

## Tests

```bash
./test/smoke.sh   # static checks
./test/e2e.sh     # realistic user flows
```
