A scrolling message list that keeps its position when new items arrive. Wrap it in `MessageScrollerProvider`, then nest viewport, content, and items.

Every `MessageScrollerItem` needs a stable `id` so the scroller can anchor to it.
