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

- `mulmocast@^2.10.0`（devDependency）— `beatToHtml` はこの版で公開された
- `@mulmocast/deck` を `^1.2.0` → `^2.0.0` に。cli が 2.0.0 を要求するので、上げないと
  top-level に 1.2.0・`mulmocast` 配下に 2.0.0 が同居する。peerDependencies も揃える。

`yarn link` で動作確認したあと publish し、公開版で再確認した。クリーン install
（`rm -rf node_modules && yarn install --frozen-lockfile`）で CI と同じ経路も通している。
