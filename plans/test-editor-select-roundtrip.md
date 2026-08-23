# Inspector / ContentBlockEditor に最初のテストを入れる

きっかけ: #43 で使い捨てにした差分ハーネスの「性質」を常設化する約束。
この2ファイル（合計1600行超）にはテストが1つも無かった。

## 固定した性質

> このエディタ群のどの select も、option X に変更して emit された値で再マウントすると X を読み戻す。

`:value` と `@change` は各サイトで別々に書かれているので、**別のパスを指していても誰も気づかない**。
`<select :value>` は DOM プロパティなので、配線を間違えても**描画される HTML は同一**になる。
実際に駆動して往復させる以外に、この2つが同じ場所を指していることを確かめる方法が無い。

## 仕掛け

SFC はコンパイルしないとマウントできない。`ssrLoadModule` は SSR 向けにコンパイルするので
クライアントマウントできず（`useSSRContext` で落ちる）、`@vitejs/plugin-vue` で lib ビルドして
jsdom にマウントする。1テスト実行につき1回、1秒未満。

select の同定は **index ではなく (option 一覧, その中での出現順)**。レイアウトを変えると
フォームが作り替わるので index は意味が変わる。この変更で「行方不明」が 413 → 0 になった。

## 3種類の skip を数えて出力する

`makeSlide` の13レイアウト + `makeBlock` の13ブロック型 = 全 1072 ケース:

```
round-trips checked 864; command selects 169; no emit 39; control gone 0
```

- **command select (169)** — 「+ ブロック追加」のように、実行して自分で空に戻す select。
  値ではないので往復しない。**推測ではなく観測で判別している**: dispatch 直後に自分で
  空へ戻したかを見る（このハーネスでは親が再レンダしないので、値 select は設定値を保つ）
- **no emit (39)** — 現在値と同じ option を選んだ場合など、何も emit しないもの
- 数は `t.diagnostic` で毎回出す。黙って落とすと「全部見た」と読めてしまう

`MINIMUM_ROUND_TRIPS = 800` は floor。select を描画しなくなる変更が入ると、
アサーションが1つも実行されないまま緑になるのを防ぐ。

## テストが盲目でないことの確認

3種の意図的な破壊すべてで落ちることを確認済み:

| 壊し方 | 結果 |
|---|---|
| `:value` を別フィールドへ（`slide.density` → `slide.titleSize`） | 🟢 落ちる |
| ハンドラのフィールド名を変える（`align` → `aligns`） | 🟢 落ちる |
| `AccentColorSelect` が常に `undefined` を emit | 🟢 落ちる |

## 書いている途中で見つかったこと

1. **eyebrow の色は label が空だと無視される** — `setEyebrow` が `!next.label` で eyebrow ごと
   落とす。placeholder が `(empty = none)` なので仕様。ただし色だけ選ぶと無反応になるので、
   UI としては label が空のとき select を disabled にする余地がある。仕様として別テストで固定した
2. **`ContentBlocksEditor.vue` の "+ ブロック追加" だけ日本語** — 他の UI は全部英語
   （"+ Add slide" / "+ chip" / "+ line"）。この PR では触っていない
