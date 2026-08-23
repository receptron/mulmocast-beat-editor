# accent color の select 16コピーを1コンポーネントに

issue: #42

## 何を抽出したか

`components/AccentColorSelect.vue`（25行）。`Inspector.vue` の10箇所と
`ContentBlockEditor.vue` の6箇所が呼び出しに変わる。

副産物として `as never` × 16 と `$event.target as HTMLSelectElement` × 16 が消える。
`ACCENT_COLORS.find((accent) => accent === value)` が `AccentColorKey | undefined` を
cast 無しで返すため。

## 挙動が同じであることをどう示したか

この2ファイルにテストは無い。読んで判断せず、抽出前後を**実際に走らせて**比較した。

`@vitejs/plugin-vue` で2コンポーネントをクライアントビルドし、jsdom に実マウント。
`makeSlide` の13レイアウト + `makeBlock` の13ブロック型 = **26 fixture / 132 select /
1072 変更ケース**について3つを記録:

1. `innerHTML` 全体
2. 各 select の**現在値**と option 一覧
3. 各 select を各 option に変更したときに emit される payload と、その payload で
   再マウントしたときの**読み戻し値**（`:value` と `@change` が同じパスを指すことの往復確認）

結果: **3次元とも 0 差分**。

### 3 が要る理由

0 はハーネスについての主張なので、意図的に壊して差分が出ることを確認した。
**旧コードで**ハンドラのフィールド名を1つだけ `color` → `colour` にすると:

```
HTML 差分 0 / 現在値 差分 0 / 配線 差分 1
```

**新コードで** emit を常に `undefined` にすると:

```
HTML 差分 0 / 現在値 差分 0 / 配線 差分 19
```

どちらも HTML 比較と現在値比較には見えない。HTML だけを見るハーネスはこの種のバグに盲目。

`<select :value>` は DOM プロパティなので **SSR した HTML には `selected` が出ない**。
`renderToString` ベースのハーネスは現在値の配線ミスを一切検出できないため、実マウントが要る。

### mutation sweep の作法

新コンポーネントは**未追跡ファイル**だったため、最初の sweep で `git checkout --` が効かず
mutation が累積し、「復元」も復元になっていなかった。pristine コピーを取り、**各 mutation の
前後で `cmp` で一致を検証**する形に直した。4種の mutation はすべて差分を出し、最終状態は
pristine 一致・0差分。

## ハーネスは残していない

抽出前のコードに依存する部分は無いので原理的には残せるが、`yarn test`（node:test / 純関数）に
vite のクライアントビルドと jsdom を持ち込むことになるため、この PR には入れない。

残す価値のある**性質**はこれ:

> このエディタ群のどの select も、option X に変更して emit された payload で再マウントすると、
> その select は X を読み戻す。

常設テストにするかは別途判断。ハーネス一式は PR 本文に手順を残す。
