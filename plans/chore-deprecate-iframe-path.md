# iframe 版を deprecated にして、div 版を既定の入口にする

issue: #39

## 決定

export は残す。1.1.1 の public API なので削除は破壊的変更になる。代わりに
「どちらが現行か」を型・demo・README の3か所で示す。

## 対象

deprecated にするのは iframe 版だけの4つ:

| export | 実体 | 代替 |
|---|---|---|
| `DeckEditor` | `src/DeckEditor.vue` | `BeatListEditor` |
| `MulmoScriptDeckEditor` | `src/MulmoScriptDeckEditor.vue` | `BeatListEditor` |
| `DeckList` | `src/components/DeckList.vue` | `BeatListEditor` の左ペイン |
| `SlidePreview` | `src/components/SlidePreview.vue` | `BeatView` |

**`Inspector` は対象外。** #36 で `editors/SlideEditor.vue`（div 版）が使うようになっており、
iframe 版とは無関係に現行 API である。

## 手順

1. `src/index.ts` の4つに `@deprecated` JSDoc。代替コンポーネント名を本文に書く。
2. **消費者に届くことを確認する。** 載らなければこの変更は何も達成していない。

   **grep では足りなかった。** 最初に書いた形は emit された `.d.ts` に `@deprecated` を4件残したが、
   TypeScript の language service は1件も報告しなかった:

   ```ts
   /** @deprecated ... */
   export { default as DeckEditor } from "./DeckEditor.vue";   // 🔴 消費者に届かない
   ```

   届く形は JSDoc を specifier の内側に置くもの:

   ```ts
   export { /** @deprecated ... */ default as DeckEditor } from "./DeckEditor.vue";   // 🟠 届く
   ```

   4形を language service で測った結果: 再エクスポートの上の JSDoc 🔴 / specifier 内の JSDoc 🟠 /
   `import` してから documented な `export { X }` 🔴 / `export declare const` エイリアス 🟠。

   検証は `ts.createLanguageService(...).getSuggestionDiagnostics()` を `dist/lib` に対して直接走らせ、
   `reportsDeprecated` が立つ識別子を数える。自分で置いた `@deprecated` な CANARY を同じファイルに入れて
   ハーネスの生存を確認すること — 「0件」はコードではなくハーネスについての主張になり得る。
3. demo (`src/App.vue`): 初期 view を `beatEditor` に。iframe 版のタブは `Slide editor (legacy)`。
4. README: Features / Quick start / コンポーネント表を div 版先頭に。iframe 版に deprecated 注記。

## 検証

- `yarn format` → `yarn lint` → `yarn build` → `yarn test`
- `.d.ts` に `@deprecated` が4つ載る（手順2）
- `yarn dev` で demo を実ブラウザで開き、①初期表示が beat editor ②legacy タブに切り替えて
  iframe 版が従来どおり描画・編集できる（deprecated は「壊す」ではない）

## やらないこと

iframe 版の削除、WYSIWYG の div 版への移植。どちらも major の判断。
