# slide beat editor を Inspector に繋ぐ

`#32` ①。

## 現状

`src/editors/SlideEditor.vue`（22行）は `image.slide` の `title` と `subtitle` しか編集できず、本文にこう書いてある:

> A slide beat carries a full @mulmocast/deck layout. Only its title and subtitle are edited
> here; the rest of the layout comes from the script.

一方 `src/components/Inspector.vue`（1114行）は **同じ `SlideLayout` を** 13レイアウト × 13ブロック型で
フル編集でき、`{ slide: SlideLayout }` を受けて `update(slide: SlideLayout)` を返すだけの契約になっている。
つまり必要なものは既にあり、繋がっていないだけ。

## 設計

`SlideEditor.vue` を **アダプタ**にする。新しい編集 UI は書かない。

```
beat.image.slide ──(型ガード)──> Inspector ──update(slide)──> withImageField(beat, "slide", slide)
```

- `EditableBeat` は `Record<string, unknown>` なので、`Inspector` の `slide: SlideLayout` に渡す前に
  **型ガードで絞る**。`as` は使わない（グローバル規約）
- ガードの判定は `layout` が `LAYOUT_TYPES` のどれかであること。これは `Inspector` 自身が
  `switchLayout` / `makeSlide` で分岐に使っている軸と同じで、独自の妥当性判断を増やさない
- 絞れないとき（`slide` が無い / 編集途中で壊れている）は Inspector を出さず、
  `makeSlide(layout)` でレイアウトを選んで作れる導線を出す。**黙って落とさない**

## 影響範囲

- `src/editors/SlideEditor.vue` のみ。レジストリの登録行（`slide.form`）も契約も変わらない
- `Inspector` は `src/index.ts` から公開済みで、props/emits も変えない
- 循環 import は無い（`Inspector` は `editors/` を参照しない）

## 確認すること

- `slide` beat を選ぶと Inspector が出て、レイアウト切替・ブロック追加・並べ替えが
  **プレビューに反映される**（build が通ることではなく、実際に動くこと）
- `image.slide` が無い beat（手で壊した場合）で導線が出て、選ぶと編集できる状態になる
- 他の beat type のエディタが変わっていない
