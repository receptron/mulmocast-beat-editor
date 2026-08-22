# feat: beat 一覧上での編集 UI

issue: receptron/mulmocast-deck-web#23。

## 決定（issue に記録済み）

| 論点                 | 決定                                                                    |
| -------------------- | ----------------------------------------------------------------------- |
| 編集方式             | 左に一覧・右に編集ペイン                                                |
| 追加・削除・並べ替え | 含める                                                                  |
| 既存 `DeckEditor`    | 並存（壊さない）                                                        |
| 種別ごとの UI        | 各種別に専用フィールド。`chart` の `chartData` だけ JSON テキストエリア |

## 構成

- `src/beatHelpers.ts` — 純粋関数（`makeBeat` / `withImageField` / `withNestedField` / `readString` / `moveItem`）
- `src/beatRuntime.ts` — runtime の読み込みと駆動。ギャラリーと編集で共有
- `src/components/BeatEditor.vue` — 種別ごとのエディタ
- `src/BeatListEditor.vue` — 一覧 + 編集ペイン
- `src/App.vue` — 「Beat editor」タブ

## 書き戻しを設計し直さなかった理由

issue は「全 beat 種別を扱うなら `MulmoScriptDeckEditor` の書き戻しを設計し直す必要がある」と
書いていたが、**beat 配列を直接編集すればその複雑さは要らない**。既存の書き戻しが複雑なのは
「slide beat だけを抽出して positional zip する」からで、並べ替えが未対応なのも同じ理由。
ここでは beat は beat なので、追加・削除・移動はただの配列操作になる。

## 型について

編集中の beat は `Record<string, unknown>` で扱う。入力途中の beat は日常的に不正
（打ちかけの URL、キーストローク途中の chartData）で、それを禁じる型はキーストロークごとに
戦うことになる。`beatToHtml` は描画できないものに `undefined` を返すので、プレビューは
壊れるのではなく退化する。

## chart の JSON

`chartData` は自由形式のレコードなので JSON テキストエリア。**不正な JSON では beat を
更新せず、エラーだけ表示する** — そうしないとキーストロークのたびにプレビューが消える。

## host としての知見（ギャラリーと共通）

- Tailwind の preflight がタグ既定を消すので、markdown 由来のマークアップの復元は host の責務
- Chart.js のインスタンスは保持して `destroy()` する（同じ canvas を再利用できない）
- 断片は slide 用のサイズ（chart は 400px 固定、slide は `w-full h-full`）なので、一覧では
  host 側で高さを抑える
