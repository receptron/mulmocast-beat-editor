# 壊れたスライドでも Inspector が落ちないようにする

#88

## 問題

`isSlideLayout` は編集中の値を `layout` の名前だけで「スライド」と判定する（中身が壊れていても弾かないための設計）。一方 Inspector のフォームは、スライドのオブジェクトの中を確認せずに読むので、描画時に落ちる。利用者は直す前に編集できない。

全レイアウトの skeleton（`makeSlide`）の各欄を、無い・null・文字列、リストなら null / 文字列 / 数値の要素、にして Inspector を実際に mount して測った。落ちたのは:

- `comparison` の `left` / `right` が無い・null
- `columns` / `grid` / `stats` / `timeline` / `matrix` / `funnel` / `waterfall` / `manifesto` のリストに null の要素

issue に書いた comparison だけでなく、同じ種類が 8 レイアウトにあった。さらに一段下でも同じ: パネル・列・セルなどのブロック一覧（`content`）に null があると落ち、bullets ブロックの `items` に null があっても落ちた（cross review round 1 の P2 と、同じ round の Claude 側の測定）。

## 直し方

`v-for` ごとに守りを足すと十数か所になり、次のレイアウトでまた穴が開く。描画の前に一度だけ直す。

- 純粋関数 `inspectableSlide(slide)`（`src/inspectableSlide.ts`）: そのレイアウトの `makeSlide` skeleton を手本に、欄ごとに
  - オブジェクトであるべき欄がオブジェクトでない → skeleton の値。無い場合は、deck の schema で必須のときだけ（`split` の省いた片側は省いたまま）
  - オブジェクトのリスト → 長さと位置を保ったまま、オブジェクトでない要素だけ skeleton の要素に置き換える（編集が選んだ要素に届くように）
  - それ以外は触らない
  - レイアウトごとの分岐は書かない。新しいレイアウトも `makeSlide` に足せば同じ扱いになる
- 必須かどうかは、skeleton からその欄だけ抜いて deck の `slideLayoutSchema` に通して判定する（skeleton が有効なことはテスト済み）
- 公開の `Inspector` は、直したスライドを内部の `InspectorForm`（これまでの Inspector そのまま）に渡す薄い包み。props / emits は同じ。編集すると直した形が書き戻される
- ブロック一覧: Inspector のブロック一覧はすべて `ContentBlocksEditor` を通るので、そこで `renderableBlocks` を使う（ブロックでない要素は同じ位置の text ブロック）
- bullets の項目: `bulletText` / `isBulletObj` が `unknown` を受け、null の項目は空行として描き、編集すると `{ text }` の形を書き戻す

## 検証

- `inspectableSlide` の単体テスト: 正しいスライドはそのまま、必須のパネルの補い、省いた任意の欄はそのまま、リストの長さと位置、入力を書き換えないこと
- 全レイアウト × 全欄 × 壊し方を `LAYOUT_TYPES` と `makeSlide` から生成して、実際に mount して落ちないこと。パネル・リスト要素ごとに `content: [null]` も加える（新しいレイアウトも自動で対象になる）
- 全ブロック種別 × 全欄 × 壊し方を `BLOCK_TYPES` と `makeBlock` から生成して、`ContentBlockEditor` を mount して落ちないこと
- 壊して確認: 包みが直さない・リストの要素を直さない・全欄を必須扱い・全欄を任意扱い、のいずれでも赤
- 実ブラウザ: 壊れた comparison / columns を貼って Inspector が描け、編集で直してプレビューが描かれること
