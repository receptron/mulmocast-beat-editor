# サンプルを増やす

`#32` ④。

## 現状の穴（数えた）

**deck サンプルのレイアウト網羅は 13 中 7**:

| サンプル | 使っているレイアウト |
|---|---|
| `minimal`（4枚） | title / stats / comparison / bigQuote |
| `bootcamp`（19枚） | comparison×9 / grid×4 / bigQuote×3 / title / manifesto / timeline |

**出てこない**: columns / split / matrix / table / funnel / waterfall の6つ。

**beat サンプル**は 8 型すべてを 11 本で覆っているが、
`#35` で編集できるようになった **markdown の `row-2` / `2x2`** と、
`html_tailwind` の **`elements`（swipe 宣言形式）** が無い。

## やること

### deck: `slide_deck_showcase.json` を取り込む

`mulmocast-cli` の `scripts/slides/slide_deck_showcase.json` が **12レイアウトを1枚ずつ**持っている
（`manifesto` だけ無い）。`bootcamp_v2_kickoff.json` と同じやり方で `src/data/` にコピーし、
`fromMulmoScript` で slides + theme を取り出す。

**内容を作らない**のが要点。実在の維持されているショーケースをそのまま使う。
`manifesto` は `bootcamp` が持っているので、**2つ合わせて 13/13** になる。

### beat: 3本足す

- `markdown (row-2)` — 片方のスロットを**文字列**、もう片方を**行の配列**で書き、
  レンダラが同じに描くこと（`#35` の前提）をサンプル自体で示す
- `markdown (2x2)` — frame 無しの4スロット
- `html_tailwind (elements)` — swipe 宣言形式

## 確認すること

- showcase を選ぶと12枚が並び、テーマが効く
- 追加した3本が**実際に描画される**（空箱でない）
