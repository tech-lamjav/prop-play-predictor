The signature Smart Betting surface — white background, 1px hairline border, 20px (`--radius-xl`) corners. Elevation is the exception; hierarchy comes from border + background.

```jsx
<Card interactive>
  <CardHeader eyebrow="Jogos de hoje" title="4 partidas" />
  ...
</Card>
```

`interactive` adds a subtle hover shadow + green border tint. `CardHeader` composes the eyebrow + section title + optional right-aligned `action`.
