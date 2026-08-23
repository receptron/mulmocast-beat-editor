# eslint を型チェック付きに上げ、警告数を天井で固定する

きっかけ: ユーザから [ever-better](https://github.com/isamu/ever-better) を参考にという指示。

## ever-better diagnose の結果と、その検証

`npx ever-better@0.4.1 diagnose` は7件のギャップを報告した。**そのうち3件は誤検知**だったので、
指摘をそのまま受け取らず1件ずつ確認した:

| 指摘 | 実際 |
|---|---|
| CI does not run lint | 🔴 誤り。`.github/workflows/pull_request.yaml:31` が `yarn run lint`（typecheck / build / test も） |
| No test runner | 🔴 誤り。`tsx --test ./test/**/test_*.ts`（node:test）。検出できていないだけ |
| TypeScript `strict` is off | 🔴 ほぼ誤り。`tsconfig.app.json` / `tsconfig.test.json` は `@vue/tsconfig` 継承で `strict=true`。off なのは `vite.config.ts` だけを見る `tsconfig.node.json` |
| 16 high-value rules not enforcing | 🟢 正しい。`--print-config` 実測。**この PR の対象** |
| 1 file over 600 lines (`Inspector.vue` 1035) | 🟢 正しい |
| No CLAUDE.md / AGENTS.md | 🟢 正しい |
| CI does not run `ever-better check` | ツール未導入なので該当なし |

## 何を変えたか

`tseslint.configs.recommended` → **`strictTypeChecked`**（`projectService` で型情報つき）。

### ノイズは無効化ではなくオプションで潰した

素で入れると **274件**。3つのオプションで **85件** になった:

| ルール | 素 | 調整後 | 何をしたか |
|---|---|---|---|
| `no-floating-promises` | 129 | **0** | 129件は全部 `test/`。`node:test` の `test`/`describe` は Promise を返すのが契約。`allowForKnownSafeCalls` で **node:test 由来のものだけ**許可。`src/` は元から0 |
| `no-confusing-void-expression` | 38 | 1 | `ignoreArrowShorthand` / `ignoreVoidOperator`。`@click="doThing()"` は Vue の書き方 |
| `restrict-template-expressions` | 23 | 0 | `allowNumber` / `allowBoolean` |

ルールごと off にしたものは無い。`no-floating-promises` は特に、このリポジトリが実際に
「1つの mermaid beat が1打鍵ごとに10件の未処理 rejection を出す」を出した後なので、
`src/` で効かせる価値がある。

残った1件（`beatRuntime.ts` の `return resolve();`）はダウングレードせずコードを直した。

### 違反0のルールは error、違反があるものだけ warn

`strictTypeChecked` は丸ごと error のまま入れ、**件数が0でないルールだけ**を件数コメント付きで
warn に落とした。これで「今きれいなルールはきれいなまま」になり、warn 一覧がそのまま backlog になる。

ルールを変えるコミットでコードを書き換えると何もレビューできないので、drain は別 PR。

### 警告数を天井で固定

`lint` を `eslint src test --max-warnings 85` に。85 でちょうど exit 0、84 にすると落ちることを
確認済み（gate が効いていることの break-check）。以後、警告が1件でも増えれば CI が落ちる。

## 副作用

lint 時間が約4秒 → 約15秒。型情報を読む分。

## やっていないこと

- 85件の drain（別 PR）
- `Inspector.vue` 1035行の分割
- `CLAUDE.md` / `AGENTS.md` の追加
- `tsconfig.node.json` の `strict`（`vite.config.ts` 1ファイル。lint 対象外なので別途）
- ever-better 自体の導入（`freeze` / `check` を CI に入れるかは別判断）
