# feat: デモに全 beat 種別のギャラリーを追加する

## 目的

`yarn dev` のデモで、`mulmocast/browser` の `beatToHtml` が描ける **8 beat 種別すべて**を
一覧できるようにする。既存のデモは `slide` beat だけを抜き出して表示していた
（`fromMulmoScript` が `type === "slide"` で絞っている）。

## 構成

- `src/data/allBeatTypes.ts` — 11 サンプル（8 種別 + markdown の3形 + chart のプラグイン付き）
- `src/components/BeatGallery.vue` — host がやることを実際にやる:
  1. `requires` が名指しした runtime をページに一度だけ読み込む
  2. 断片を挿入する
  3. `[data-mulmo-chart]` と `.mermaid` を自分で駆動する
- `src/App.vue` — 「Slide editor」/「All beat types」のタブ

## host 側の実装で分かったこと

- **Tailwind の preflight がタグ既定を消す**ので、markdown 由来の `h1`/`ul`/`p` が無装飾になる。
  復元は host の責務（`requires` は JS ランタイムしか表さない）。`.beat-fragment` スコープで戻している。
- Chart.js のインスタンスは保持して `destroy()` する必要がある。同じ canvas を再利用できない。
- メディアの URL は**実在を確認してから**書く。最初に書いた URL は 404 で、デモは alt テキストと
  黒い動画を出すだけで**失敗しなかった** — 壊れたサンプルがレビューを通り抜ける形。

## 依存

`mulmocast` が必要。`beatToHtml` は 2.10.0 で公開されるので、それまでは `yarn link` で動かす。
CI は `--frozen-lockfile` なので、**依存に入れるまで CI は通らない**（typecheck が
`Cannot find module 'mulmocast/browser'` で落ちる）。
