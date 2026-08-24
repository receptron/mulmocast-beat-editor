# feat: スライド内リスト項目のドラッグ並べ替え + FLIP (#53 PR 4)

#53 の4本目。iframe 版と一緒に消えた「プレビュー上でリスト項目を掴んで並べ替える」を div 版に戻す。

## 使える部品（PR 1 で復活済み）

`moveByPath(root, fromPath, toPath)` / `splitItemPath` / `getByPath` / `setByPath`。
deck は並べ替え可能な項目に `data-mulmo-item-path` を出しており、実測で
`columns` 2 / `grid` 3 / `stats` 1 / `timeline` 1 / `manifesto` 1 の計8件（既定フィクスチャ）。

## 設計

### 許可リストはテキスト編集と同じ形にする

`withEditingAffordances` が `data-mulmo-item-path` にも `draggable="true"` を付け、
**同じパスで `items` セットを返す**。`applyItemMove` はそのセットに無いパスを拒否する。
テキスト編集の `paths` と同じ「描画したパスだけが書ける」形で、fail-closed。

セットを2本に分けているのは、テキストパスは掴めず項目パスは編集できないため。

### パスは「位置」なので FLIP は識別子を作る必要がある

`items[0]` は**位置**であって同一性ではない。並べ替えても同じパスが同じ順に出るので、
ノード同一性にも属性にも頼れない。代わりに **移動そのものから順列を逆算**する:

```
indexBeforeMove(index, from, to)  // 今 index にある項目が、移動前にいた位置
```

これで「今の要素」と「移動前の矩形」が対応づく。全長2〜7・全 from × 全 to ×
全 index を総当りし、実際に `splice` した配列と突き合わせて検証している（500件超）。

### 再描画の境界

`v-html` が丸ごと差し替わるので、drop 時に矩形を取り、`html` watch（flush post）で
新しい順序が DOM に載ってから FLIP を再生する。

## テスト

| ファイル | 内容 |
|---|---|
| `test/test_flip.ts` | `indexBeforeMove` 総当り、`pathBeforeMove` の別配列拒否、FLIP の再生件数 |
| `test/test_inlineEdit.ts`（追記） | `applyItemMove` の許可リスト、`sameItemList`、affordance の付与 |
| `test/test_itemDragView.ts` | マウントした BeatView を実際にドラッグして emit を検査 |

### break-check

| 変異 | 結果 |
|------|------|
| `draggable` を付けない | 2件 赤 |
| 同一リスト判定を外す | 1件 赤 |
| `dragend` で状態を消さない | 1件 赤 |
| `dragover` で `preventDefault` しない | 1件 赤 |
| `indexBeforeMove` を恒等に | 3件 赤 |
| 許可リストを外す | **最初は 0件（テストが盲目だった）** → 専用ケースを足して 1件 赤 |

許可リストの変異が素通りしたのは、他の拒否ケースがすべて `moveByPath` 自身の検証
（範囲外・別配列・自分自身）で先に落ちていたため。**データ上は正当だが描画されていない
パス**を使うケースを足して初めて赤くなった。

## jsdom で見られないもの

jsdom は `DragEvent` も `DataTransfer` も実装していない。テストは plain `Event` で駆動するので、
**`setData` / `effectAllowed` / `dropEffect` の3行は covered ではない**（Firefox が
そもそもドラッグを開始するかを決める行）。実ブラウザでの確認で補う。
