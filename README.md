# BRAIBO（ブレイボ）— Brain × Ball

サッカーの戦術性と将棋・チェスの読み合いを組み合わせた 5 対 5 の同時行動ボードゲーム。
スマートフォン縦画面のブラウザで遊べる Web プロトタイプです（対 AI 戦）。

## ▶ 遊ぶ（ブラウザで開くだけ）

**https://soma-yoshiie.github.io/braibo-demo/**

スマホの Safari / Chrome、または PC のブラウザで開けます（PC ではウィンドウを縦長にすると見やすいです）。
GitHub Pages には `gh-pages` ブランチのビルド成果物が公開されています。更新は `npm run deploy:pages`。

> リポジトリ直下の `index.html` は Vite の開発用エントリなので、ファイルを直接開いても動きません。
> ソースから動かす場合は下記「起動」の手順で開発サーバーを立ててください。

## 起動

```bash
npm install
npm run dev        # http://localhost:5173 （同一ネットワークのスマホからは --host で表示される URL）
```

```bash
npm test           # ルール判定・同時移動・得点処理などのユニットテスト（vitest）
npm run typecheck  # TypeScript 型検査
npm run build      # dist/ に通常ビルド
npm run build:single   # dist-single/index.html に JS/CSS を全て埋め込んだ単一 HTML
```

## ディレクトリ

```
src/
  game/              ゲームロジック（React 非依存・純関数・乱数注入）
    types/           型定義（座標系・状態・計画・イベント）
    rules/           config（全調整値）, geometry, moves, probability, estimates
    engine/          match（初期化/キックオフ）, resolve（同時ターン解決）, log, rng
    ai/              簡易 AI（TeamPlan を返すだけ。対人戦では相手の TeamPlan に差し替え可能）
    data/            キャラクター定義・フォーメーション（データ追加だけで新キャラを追加可能）
  components/        Pitch(SVG) / Player / HUD / Controls / Overlays（表示専用・props 駆動）
  screens/           MatchScreen（画面構成）と useMatchController（進行の状態機械）
  styles/            デザイントークン
DESIGN.md            ルール仕様・暫定決定の理由・モジュール API 契約
DESIGN-UI.md         画面仕様（レイアウト・演出・同じマスに 2 人いるときの表示）
concept/             構想資料の PDF と、その元になった HTML（concept/src）
```

## 調整ポイント

- 盤面サイズ・ゴール位置・クロス可能列: `src/game/rules/config.ts` の `BOARD`
- ターン数・作戦時間・先攻: `MATCH`
- 競り合い／パス／クロス／シュート／ブロックの各確率式: `RULES`
- キャラクターの移動ベクトル・能力・スキル: `src/game/data/characters.ts`
- 初期配置: `src/game/data/formations.ts`
