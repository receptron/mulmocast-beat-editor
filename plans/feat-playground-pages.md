# デモを playground として公開し、MulmoScript を貼り付けて試せるようにする

#78

## ゴール

- デモ（`yarn dev` のアプリ）を GitHub Pages で公開する
- 同梱サンプルに加えて、自分の MulmoScript JSON を貼り付けて editor に読み込めるようにする

## 公開（`.github/workflows/pages.yml`）

mulmoclaude の `pages.yml` に合わせる。

- `main` への push（と手動実行）で build → deploy
- build: `yarn install --frozen-lockfile` → `yarn typecheck` → `vite build --base "<configure-pages の base_path>/"`
  - base を決め打ちしない。リポ名が変わっても（deck-web → beat-editor のように）追従する
- deploy: `actions/deploy-pages`。`pages: write` / `id-token: write` は deploy ジョブにだけ
- top-level は `contents: read`、checkout は `persist-credentials: false`、`concurrency: pages`
- リポの Pages 設定を「GitHub Actions」ソースで有効化する（初回のみ、設定変更）

## 貼り付け（`src/pastedScript.ts` ＋ `App.vue`）

- 純粋関数 `readPastedScript(text)` → `{ beats }` か `{ error }`。読めない理由ごとにメッセージを返す
  - 空、JSON として読めない、オブジェクトでない、`beats` が配列でない、`beats` が空
  - `beats` の取り出しは既存の `beatsOf` を使う（要素は一つも捨てない — round-trip で削除にならないように）
- `App.vue`: ヘッダーの台本選択の隣に「Paste JSON」。開くと textarea と Load。読めなければエラーを出し、今の beats は変えない
- 既存の Reset は「選んでいるサンプルに戻す」のまま

## 検証

- `test/test_pastedScript.ts`: 正常（beats を返す・要素をそのまま渡す）と異常（空・壊れた JSON・配列・null・数値・beats なし・beats が配列でない・空配列）
- `yarn typecheck` / `yarn lint` / `yarn build` / `yarn test`
- base 付きで build したものを `vite preview` で開き、実ブラウザで ①描画される ②console error が無い ③貼り付け → 描画、を確認
