# FC Barcelona Card

<p align="center">
  <img src="https://img.shields.io/badge/HACS-Custom-orange?style=for-the-badge" alt="HACS Custom">
  <img src="https://img.shields.io/badge/HA-2026.1+-blue?style=for-the-badge" alt="HA Version">
  <img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" alt="License">
</p>

<p align="center">
  <a href="https://buymeacoffee.com/khirale">
    <img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me a Coffee" height="45">
  </a>
</p>

4 custom Lovelace cards for Home Assistant that display real-time FC Barcelona data powered by the ESPN public API.

---

## Cards

### `fc-barca-match-card`
Full-width hero card showing the next match (date, opponent, venue) or the live score with goalscorers and cards. Falls back to the last result when no upcoming match is scheduled.

### `fc-barca-standings-card`
La Liga table with Champions League spots and relegation zone highlighted. Barcelona row is always emphasized.

### `fc-barca-roster-card`
Squad list filtered by position. **Click any player to open a popup** with full bio (age, height, weight, nationality) and season stats fetched live from ESPN.

### `fc-barca-player-card`
Standalone sidebar + detail view — browse all players and click to see their profile and stats.

---

## Requirements

This card requires the **FC Barcelona Integration** to be installed first.
The integration creates the sensors that the cards read.

> [FC Barcelona Integration →](https://github.com/khirale/fc-barcelona-integration)

---

## Installation

### Via HACS (recommended)

1. Open HACS in your Home Assistant instance
2. Go to **Frontend**
3. Click the 3-dot menu → **Custom repositories**
4. Add `https://github.com/khirale/fc-barca-card` as category **Lovelace**
5. Click **Download**
6. Restart Home Assistant

### Manual

1. Download `dist/fc-barca-card.js` from the [latest release](https://github.com/khirale/fc-barca-card/releases)
2. Copy it to `/config/www/fc-barca-card.js`
3. In Home Assistant go to **Settings → Dashboards → Resources**
4. Add `/local/fc-barca-card.js` as a **JavaScript module**

---

## Configuration

### Match Card
```yaml
type: custom:fc-barca-match-card
```
No configuration needed. Automatically shows next match, live score, or last result.

### Standings Card
```yaml
type: custom:fc-barca-standings-card
```

### Roster Card
```yaml
type: custom:fc-barca-roster-card
positions:
  - G   # Goalkeepers
  - D   # Defenders
  - M   # Midfielders
  - F   # Forwards
```
You can use any combination of positions. A common setup is to split into two cards (G+D and M+F).

### Player Card
```yaml
type: custom:fc-barca-player-card
```

---

## Dashboard example

```yaml
title: FC Barcelona
views:
  - title: Barça
    icon: mdi:soccer
    type: sections
    max_columns: 4
    sections:
      - type: grid
        column_span: 4
        cards:
          - type: custom:fc-barca-match-card

      - type: grid
        column_span: 1
        cards:
          - type: custom:fc-barca-standings-card

      - type: grid
        column_span: 1
        cards:
          - type: custom:fc-barca-roster-card
            positions: [G, D]

      - type: grid
        column_span: 1
        cards:
          - type: custom:fc-barca-roster-card
            positions: [M]

      - type: grid
        column_span: 1
        cards:
          - type: custom:fc-barca-roster-card
            positions: [F]
```

---

## Features

- Live score and match events (goals, yellow/red cards) updated every minute during a match
- Adaptive polling — high frequency only during live matches, low frequency otherwise
- Player popup with season stats fetched client-side from ESPN (no extra HA sensors)
- Stats cached in memory — fetched once per session per player
- Player photo from ESPN CDN with jersey number fallback
- Auto-discovery of sensor entity IDs — works even if HA appended a suffix (`_2`, `_3`…)
- Team and opponent logos as blurred background in the match hero card

---

## Data source

All data comes from the [ESPN public API](https://www.espn.com). No API key required.

---

## License

MIT
