The Recharts wrapper that gives a chart the design system's colors, tooltip, and legend. Pass a `config` keyed by series name; each key becomes a `--color-<key>` CSS variable you reference from the series `fill` or `stroke`.

`ChartTooltip` needs `content={<ChartTooltipContent />}` to render the styled tooltip.
