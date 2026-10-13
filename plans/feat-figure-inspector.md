# Inspector に figure レイアウトの編集フォームを足す

#86

## ゴール

`figure` スライド（deck 2.1.0、chart / mermaid ブロック一つをスライドいっぱいに）の中のブロックを、Inspector で編集できるようにする。

## 設計

- 中のブロックの編集は既存の `ContentBlockEditor` を再利用する（chart: title ＋ chartData JSON、mermaid: title ＋ code）。二つ目の chart / mermaid フォームは作らない
- `ContentBlockEditor` に省略可能な props を 2 つ足す。指定しない既存の呼び出し（`ContentBlocksEditor` のブロック一覧）は今と同じ表示
  - `types`: 種別の選択肢を絞る。figure は `FIGURE_BLOCK_TYPES`（chart / mermaid）
  - `single`: 位置の番号・並べ替え・削除を出さない。figure のブロックは常に一つで、消せない
- Inspector の `figure` 節: `setFigure` は `isFigureBlock` で chart / mermaid だけを通して `patch<FigureSlide>({ figure })`
- 種別を切り替えると、その種別の既定のブロック（`makeBlock`）に置き換える。他のブロック一覧と同じ挙動

## 検証

- `FIGURE_BLOCK_TYPES` / `isFigureBlock` の単体テスト
- figure の種別の選択肢が chart / mermaid だけで、切り替えると `figure` が置き換わること。他の場所の選択肢は全種別のまま
- 既存の「全 select の round-trip」テストが `layout:figure` も回す（`LAYOUT_TYPES` から fixture を作るため）
- 実ブラウザで、figure スライドを選んで Inspector からブロックを編集 → プレビューに反映
