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
| FLIP の配線（`playPendingFlip()`）を削除 | 1件 赤 |
| invert の符号を反転 | 3件 赤 |
| drag source を `closest()` に戻す | 1件 赤 |
| テキスト選択中の抑止を外す | 1件 赤 |
| 外側への探索をやめて最内マーカーだけ見る | 1件 赤 |
| 単一要素リストも draggable にする | 1件 赤 |
| stagger アニメの抑止をやめる | 1件 赤 |
| 許可リスト（BeatView 側）を外す | 1件 赤 |
| `indexBeforeMove` を恒等に | 3件 赤 |
| ホスト相対をやめてビューポート相対に戻す | 1件 赤 |

## 最初のレビューで露見した、テストの盲点

`/code-review` が実測で突いた穴。**すべて再現を自分で確認した**:

| 変異 | 当時の結果 |
|------|-----------|
| `playPendingFlip()` を丸ごと削除（＝アニメが一切動かない） | **291 pass / 0 fail** |
| FLIP の符号を反転 | **6 pass / 0 fail** |
| BeatView 側の許可リスト2箇所を削除 | **291 pass / 0 fail** |

原因は3つとも同じ形で、**ゲートが「純関数」と「画面」の間の継ぎ目を一つも通っていなかった**:

- `test_flip.ts` はコンポーネントを一度も mount しない
- `test_itemDragView.ts` は emit された beat と描画テキストしか見ない
- jsdom は矩形をすべて 0 で返すので、mount した経路では原理的に観測できない

対策として、①`playItemFlip` が適用した変位を返すようにし、②`style.transform` への書き込みを
スパイで記録し、③`Element.prototype.getBoundingClientRect` をプロトタイプごと差し替えて
mount した状態にレイアウトを与えた（`v-html` が再描画で要素を入れ替えるため、事前に個別の
要素へスパイを張ることができない）。

**このゲートを作った直後に、実際のバグが1件出た**: `pending_flip` の同一性を「移動前の beat」と
比べていて、ホストが更新を適用すると必ず不一致になり FLIP が再生されなかった。移動が
生成した beat と比べるよう修正した。

## レビューで直したもの（21件）

| # | 内容 |
|---|------|
| 1,3 | テキスト選択のドラッグが item ドラッグとして扱われ、拒否されたドロップがパス文字列を本文に差し込む（Firefox / WebKit で実測）→ 選択中・編集中は `dragstart` を `preventDefault` |
| 2 | カード内の `<img>` / `<a>` が drag source になりリストが並べ替わる（Chromium + Firefox で実測）→ `closest()` をやめ、marked 要素自身に限定 |
| 4 | 入れ子パスのため、カードは padding 部分でしか掴めない（実測）→ ドロップ先を外側へ探索 |
| 5 | `setData("text/plain", path)` が外部の入力欄にパスを書き込む（実測）→ 専用 MIME タイプに変更し、ドロップは常に `preventDefault` |
| 6 | `dragging_path` が beat 同一性を持たず、再描画で `dragend` が届かないため latch する → beat を同伴し、`html` watch で消す |
| 7 | ホストが emit を無視すると `pending_flip` が古い矩形を抱えたまま次の描画で発火 → 生成された beat と一致するときだけ再生 |
| 8 | deck の stagger CSS（`animation: … both`）が inline transform に勝つため FLIP が効かない（実測）→ 再生中だけ `animation: none` |
| 9,10,11 | 上記のゲート不在（本節） |
| 12 | `aria-label="Reorder <path>"` がキーボード操作の無い機能を約束し、`<div>` では属性自体が無効 → 削除 |
| 13 | 矩形がビューポート相対で、間のスクロールが偽の移動になる → ホスト相対に変更 |
| 14 | `draw()` がチャートを同期的に破棄した後に「Last」を測っていた → FLIP を `draw()` より前に実行 |
| 15 | 要素1つのリストにも drag を出していた（既定フィクスチャの `stats`/`timeline`/`manifesto` が該当）→ 2件未満の配列は対象外 |
| 16 | `splitIndexed` が `splitItemPath` の完全な重複 → 既存を import |
| 17 | grab カーソル等の手掛かりが一切無かった → `documentStyles.ts` に追加 |
| 18 | inline transition が消えず、次の transform まで巻き添えでアニメ → `transitionend` で後始末 |
| 19 | `dragOverAccepted` が `dragstart` を張りっぱなしにしていた → `dragend` で均衡 |
| 20 | 矩形を拒否判定より前に、しかも beat 全体で測っていた → 成立後に、対象配列だけ |
| 21 | ChangeLog / README が「この機能は無い」と書いたまま → Unreleased を追加し README を修正 |
