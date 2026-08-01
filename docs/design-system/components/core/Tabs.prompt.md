Tab / segmented control. `segmented` is the pill-group toggle (e.g. "Por Score / Por Gatilho"); `underline` is a forest-underline tab bar.

```jsx
<Tabs items={[{label:"Por Score",value:"score"},{label:"Por Gatilho",value:"trigger"}]}
      defaultValue="score" onChange={setSort} />
```
