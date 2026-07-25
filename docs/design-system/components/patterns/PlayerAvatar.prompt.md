Player or team avatar. `circle` for list/search rows; `square` for the hero photo block (forest-gradient fallback + optional team-abbr badge). Falls back to initials on missing/broken image.

```jsx
<PlayerAvatar name="Austin Reaves" src={photoUrl} size={40} />
<PlayerAvatar name="Austin Reaves" shape="square" size={160} teamAbbr="LAL" showTeamBadge />
```
