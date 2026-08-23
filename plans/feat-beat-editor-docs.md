# beat editor 層を README とデモに出す

`#32` ②。

## 現状

`src/index.ts` は beat 側を公開している:

```ts
export { default as BeatView } from "./components/BeatView.vue";
export { default as BeatEditorPane } from "./components/BeatEditorPane.vue";
export { default as BeatListEditor } from "./BeatListEditor.vue";
export { defaultBeatEditors, editorsFor } from "./editors/registry";
export type { BeatEditorDefinition, BeatEditorProps, BeatEditorEmits } from "./editors/types";
export { BEAT_TYPES, makeBeat, beatType, beatImage } from "./beatHelpers";
```

**README にはこのうち1つも出てこない。** Inspector は5箇所で説明されているのに、
「beat を編集する」という機能自体が文書として存在しない状態。

デモには `Beat editor` タブがあるが、**拡張点（自前 editor の登録）は動くものとして見えない**。
`BeatListEditor` は `editors` prop を受けて `BeatEditorPane` に渡すので、口は空いている。

## やること

### README

1. 冒頭 — このパッケージには**2つのエディタ**（slide deck / beat）があると書く
2. Usage に「Edit a MulmoScript's beats」節（`<BeatListEditor v-model:beats>`）
3. Usage に「Register your own beat editor」節 — `BeatEditorDefinition` の契約と、
   `[...defaultBeatEditors, mine]` の最小例
4. 同梱 editor の一覧表（どの型に何があるか）。**読者が「どこを差し替えたいか」を判断できるようにする**
5. Components 表に beat 側3コンポーネント + registry を追加
6. Architecture に beat 側のツリーを追加
7. Scripts に抜けている `test` / `typecheck` / `knip` を追加

### デモ

`src/demo/OutlineTextSlideEditor.vue` を足し、App から
`[...defaultBeatEditors, outlineEditor]` を `BeatListEditor` に渡す。

- `textSlide` は既に `Form` を持つので、**1つの型に2つ目を足す**例になる
  （タブ切り替えが出る = レジストリが効いていることが画面で分かる）
- 中身は「1行目 = title、残りの行 = bullets」の1テキストエリア。
  `Form` と**同じ shape への別の入り口**で、chart の `Form` / `JSON` と同じ発想
- 実装は既存の `withNestedField` を2回通すだけ。新しい書き込み経路を作らない

## やらないこと

同梱 editor の中身は変えない（`markdown` の layout 形式などは `#32` ③）。
`defaultBeatEditors` にも足さない — デモが**外から**登録することに意味がある。

## 確認すること

- `Beat editor` タブで textSlide beat を選ぶと `Form` / `Outline` のタブが出て、
  **どちらで編集してもプレビューが更新される**
- 他の型のペインが変わっていない
