# markdown の layout 形式を編集可能にする / chart の title を足す

`#32` ③。

## 調べて分かったこと — issue の前提が半分間違っていた

`#32` には「chart form を Inspector 並みに」と書いたが、**逆だった**。

`components/ContentBlockEditor.vue` の `chart` ブロックは **生 JSON の textarea 1個**で、
`mermaid` も title + textarea だけ。beat 側の `editors/ChartFormEditor.vue`（form + JSON、
`writeChartForm` が未知のキーを保持）の方が**既に上**。

しかも `ChartFormEditor` 自身が、フォームを `options` まで広げない理由を書いている:

> Growing the form to cover `options` is what the JSON editor is instead of.

**この判断を理由なく覆すのは間違い**なので、chart のフォーム拡張はやらない。

## やること

### A. markdown の layout 形式（本体）

`mulmoMarkdownMediaSchema` の `markdown` は union:

```
string | string[] | ({ header?, "sidebar-left"? } & ({content} | {"row-2"} | {"2x2"}))
```

今の `MarkdownEditor.vue` は string 形式だけ編集でき、layout 形式は read-only。

- 純粋なヘルパを `src/editors/markdownLayout.ts` に切り出す（`test/` から直接テストできる形）
- スロットは `string | string[]`。レンダラは配列を `join("\n")` するので**表示は同じ**。
  **書き戻しは authored な形を保つ**（配列だったスロットは `split("\n")` で配列のまま）
- main の切り替えは、広げるときは空スロットで埋め、`content` に狭めるときは**残りを連結**する。
  消えるスロットの文章を黙って捨てない
- **string ⇄ layout の変換**: string → layout は常に安全なのでボタン。逆は
  **frame も無く `content` だけのときのみ**（= 失うものが無いときだけ）ボタンを出し、
  それ以外は理由を出す。黙って落とさない

### B. chart の `title`

`mulmoChartMediaSchema` の `title` は **required** だが、`ChartFormEditor` にフィールドが無く、
`ChartJsonEditor` は `chartData` の話なので届かない。**必須フィールドに入り口が無い**状態だったので、
form に1つ足す。フォームを `options` へ広げるのとは別の話。

## 確認すること

- string → layout → 2x2 → content → string の**往復で文章が失われない**
- 2x2 のスロットとヘッダを打つと、プレビューがグリッド + ヘッダとして描き直される
- chart の title がプレビューの見出しに出る
