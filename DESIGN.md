# BRAIBO（ブレイボ）設計仕様 v0.4

サッカー × 将棋的読み合いの 5 対 5 同時行動ボードゲーム。本書はプロトタイプの
ルール仕様・ゲームデザイン上の暫定決定とその理由・モジュール間 API 契約をまとめたもの。
数値はすべて `src/game/rules/config.ts` に集約した暫定値であり、調整前提。

---

## 1. 盤面と座標

- 7 列 × 10 行。`x: 0..6`（左→右）、`y: 0..9`（上→下）。
- **青（人間）は下側が自陣**、上方向（y が小さい方）へ攻める。赤（AI）はその逆。
- ゴールは各エンドライン中央（`goalX = 3`）。シュートの目標点は盤外半マスの
  `(3, -0.5)` / `(3, 9.5)`。「ゴールマス」を盤上に置くと選手が立てて不自然になるため盤外扱いにした。
- ゴール幅・盤面サイズは `BOARD` で変更可能（UI はこれを読む）。

## 2. ターン構造（同時行動）

1. **作戦フェーズ**: 人間は 5 人の移動先と（ボール保持時）ボール行動を指定。AI は内部で同じ形式の `TeamPlan` を生成。
2. **実行**: `resolveTurn(state, plans, rng)` が決定論的に処理し、`TurnEvent[]` を返す（UI はイベント列を演出に使う）。
3. 処理順序は固定:
   1. 移動の正規化（不正な移動は「その場」扱い）
   2. 全 10 人の同時移動。同チームの重なりを解消し、**ボールが絡むマスでだけ**競り合う（§4）
   3. ルーズボールの拾得（両チームが同時に入った場合は競り合い、§4）
   4. ボール行動（パス／クロス／シュート）— **移動後の最終位置で判定**
   5. 得点処理 → キックオフ配置へリセット
   6. ターン数加算、規定ターン到達で試合終了
4. 作戦時間は既定 60 秒（`MATCH.planningSeconds`、0 で無効）。時間切れは未指定＝その場として自動実行。

**理由**: 「移動してからボール行動」の一本化により、相手の移動を読んでパスコース／シュートコースに
入る守備が成立する。ボール保持者が移動後にシュートするため、守備側は「現在地」ではなく
「次に立つ場所」を予測して塞ぐ必要があり、これが読み合いの核になる。

## 3. 移動

- 各キャラクターは将棋の駒のように移動ベクトル集合 `MoveStep[]`（チーム相対、`dy<0` が前方）を持つ。
  `range: 2` は 1 歩でも 2 歩でも止まれるスライド。
- 盤外は不可。**他の駒による経路ブロックはしない**（全員同時に動くため、計画時点の位置で
  ブロック判定をすると矛盾が出る）。敵のいるマスも指定可能。相手がボール保持者なら
  「そこへ来る／留まる」と読んだタックル、それ以外なら同じマスに並ぶ密着マークになる（§4）。
- UI 側では味方の予約済みマス（移動先、または動かない味方の現在地）は選択不可にする
  （`availableMoveTargets`）。エンジン側でも同チーム衝突は解決する（AI のバグ耐性）。

## 4. マスの共有と競り合い（v0.4）

**1 マスに立てるのは各チーム 1 人まで（敵味方 1 人ずつ、最大 2 人）。**
敵と同じマスに重なっても、ボールが絡まなければ何も起きない。競り合いは **ボールがあるマスでだけ** 起き、
負けた側も **元のマスへ戻らずその場に残る**。

### 4.1 同チームの重なり（乱数を使わない）
- 同じチームの 2 人以上が同じマスを目指した場合、優先順位（ボール保持者 ＞ その場に留まる者 ＞ 小さい index）で
  1 人が残り、他は元のマスへ戻る（`bounce`、`reason: 'teammate'`）。
  負けた側が「その場に留まっていた」場合は、最寄りの空きマス（自ゴール方向優先）へ押し出される（`displace`）。
- `displace` 先に選べるのは、敵味方を問わず **誰のターン開始位置でもなく、誰の移動予定先でもなく、
  いま誰かの解決済み位置でもない** マスだけ。押し出しが新しい重なりを生んで連鎖することを防ぐ。
  候補の並び（近い順、自ゴール方向優先）は従来どおり。
- 「その場に留まる者」の判定は反復のたびに取り直す（戻された選手は、その時点から留まる者として扱う）。
- `displace` イベントは 1 人につき 1 ターンに最大 1 回。押し出された選手はそのターンの `move` を出さない。
- 解決は反復: (y, x, 青→赤) の昇順で 1 件ずつ解決し、戻された駒を含めて再チェック、重なりがなくなるまで繰り返す。
- この段階では敵の位置は一切見ない（敵と同じマスになるのは合法）。

### 4.2 ボールを巡る競り合い（1 ターンに最大 1 回、乱数 1 個）
4.1 の後の最終マスで、次の順に **最初に当てはまる 1 つだけ** を判定する。
1. **保持者のマス**: ボール保持者と同じマスに敵がいる → 競り合い。
2. **すれ違い（スワップ）**: 1 でなく、保持者と敵 1 人が互いの元マスへ入れ替わった（両者とも計画どおり移動を完了）
   → ボールだけを賭けた競り合い（位置は入れ替わったまま）。
3. **こぼれ球**: ボールがルーズで、そのマスに両チームの選手が入った → 競り合い（保持者ボーナスなし）。
   勝者がボールを拾う（`duel` に `loose: true`、続けて `pickup`。勝者に `wonBallTurn` を記録）。

- `P(A勝利) = clamp(0.5 + (physA − physB)/200 (+0.05 保持者ボーナス), 0.15, 0.85)`。
  A は「動いて入ってきた側」。一方だけが留まっていたなら留まった側が B。両方動いた／両方留まったなら A = 青。
- 勝者がボールを持つ（保持者が負けたら勝者に `wonBallTurn`）。**勝者も敗者もそのマスに残る**（`bounce`／`displace` は発生しない）。
- ボールが絡まない重なり（保持者でない敵同士、ルーズボールのないマス）は **イベントも乱数も発生しない**。
- ルーズボールのマスに 1 人だけ入った場合はそのまま拾う（`pickup`）。

### 4.3 同じマスにいる相手の扱い（ボール行動時）
- **蹴り手と同じマスの敵**（＝直前の競り合いに負けた選手）は、そのキックに対する守備判定に **一切参加しない**。
  パスカット、シュートブロック、クロスの空中戦のすべてが対象（`aerialDefender` は `kickerPos` 上の敵を除外する）。
  予測値（成功率の表示と AI の評価）も同じ除外を使う。
- **受け手（またはスペースパスの目標マス）と同じマスの敵** は「密着マーク」。コース上のオフセット 0 の選手として、
  インターセプト判定の **最後** に 1 回判定する（ゴロ: `intercept`、浮き玉: 落下地点扱いで `aerial`）。
- クロスの空中戦の相手は、受け手の 8 近傍 **と同じマス** の敵から `aerial` 最大の 1 人。
- スペースパスの目標マスに味方と敵が両方いる場合、インターセプト・精度の判定を通れば **味方が受ける**。
  敵だけなら `toEnemy`。
- パス失敗時のこぼれ先（`scatter`）と `displace` 先は従来どおり「誰もいないマス」。

### 4.4 イベント順（移動フェーズ）
`(bounce | displace)* → duel? → move* → pickup?`。`duel`（`kind: 'ground'`）は必ず `forBall: true`。

**理由**: 旧ルール（敵と重なれば必ず競り合い、敗者は元のマスへ戻る）は、ボールと無関係な場所でも
運任せの弾き合いが起き、狙った陣形が崩れる原因になっていた。新ルールでは位置取りは必ず計画どおりに決まり、
乱数はボールの奪い合いにだけ使われる。敗者がその場に残るので、抜かれても次のターンにすぐ追える／
奪われてもすぐ奪い返しに行ける連続した攻防になる。受け手と同じマスに立つ密着マークが安全に選べるようになった分、
攻撃側は「マークを外す動き」と「スペースへのパス」で対抗する。

## 5. パスとクロス

### パス（ゴロ／浮き玉の 2 種類）
- 受け手を事前に指定。判定は双方の **移動後の位置**。
- **ゴロ（ground）**: 距離上限 5（`passMaster` で +2）。精度 `P = clamp(0.97 − 0.05·(dist−1) + (pass−50)/400, 0.3, 0.98)`。
  コース上の敵（線分に対する垂直距離 ≤ `laneWidth=0.6`、かつ両端の間）が **どこにいても** パサーに近い順に
  インターセプト判定: `P = clamp(0.3 + (int−50)/250 + 0.25·(1 − d/laneWidth), 0.05, 0.9)`。
  受け手と同じマスの敵（密着マーク、§4.3）はオフセット 0 として最後に判定。蹴り手と同じマスの敵は対象外。
- **浮き玉（lofted）**: 距離上限 8（`passMaster` で +2）。精度 `P = clamp(0.86 − 0.045·(dist−1) + (pass−50)/400, 0.3, 0.98)`。
  コース上の敵のうち **蹴り手から 1.5 マス以内**（目の前、`intercept` 参照）と **落下地点から 1.5 マス以内**
  （`aerial` 参照）だけがインターセプト判定の対象。中間にいる敵は頭上を越される。
- 移動後に距離上限を超えていた場合はパスを試みず保持者がキープ（`actionCancelled`）。
- 成功で受け手が保持（`receivedPassTurn` を記録）、失敗で受け手の隣接空マスへ **ルーズボール**
  （隣接に空きマスがない場合は受け手に最も近い敵が拾う）。
- **理由**: ゴロは「安全だが遮断されやすい」、浮き玉は「遠くまで届き中盤の遮断を無視できるが精度が低く、
  両端に張られると弱い」。守備側は中盤のパスコース遮断か、受け手への密着かを選ぶ読み合いになる。
  失敗パスを即相手ボールにせず「こぼれ球」にすることで、次ターンに両者が拾いに行く攻防が生まれる。

### オフサイド
- パス（ゴロ／浮き玉／スペースパスで味方が受ける場合）とクロスが **蹴られた瞬間＝移動後の最終位置** で判定。
- 受け手 R が次を **すべて** 満たすとオフサイド: (1) 敵陣にいる（青: `R.y ≤ 4`、赤: `R.y ≥ 5`）、
  (2) ボール（蹴り手の最終位置）よりゴールラインに近い（青: `R.y < P.y`）、
  (3) 守備側の **最後尾の選手**（`lastDefenders=1`、GK がいないため最終 DF 基準。2 にすると実サッカー同様「後ろから 2 人目」）
  よりゴールラインに近い（青: `R.y < min(DF.y)`）。同じ行（並んでいる）はオンサイド。
- 距離上限超過とオフサイドが重なる場合は `actionCancelled`（届かない）が優先され、オフサイドとは判定しない。
- オフサイド時: パスは無効、ボールは受け手に最も近い守備側選手へ（同距離は index 小）。`offside` イベントを発行し
  UI は旗のバナーを表示。ドリブル・シュートはオフサイドにならない。後方へのパスも対象外。
- **理由**: 同時移動なので守備側が一斉にラインを上げる「オフサイドトラップ」が読み合いとして成立する。
  攻撃側は現在の守備位置を基準にした警告（OFFSIDE バッジ）を見つつ、相手がラインを上げるかを読んで走る。
- `RULES.offside.enabled` で無効化可能（バランス検証用）。

### スペースへのパス（スルーパス）
- 受け手ではなく **マス** を指定するパス。ゴロ／浮き玉のどちらでも出せ、距離上限・インターセプト判定は
  それぞれの種類に従う。精度は `spacePenalty=0.05` だけ低い。
- 精度判定成功後、移動後にそのマスに立っている選手が受け取る: 味方がいれば成功（`complete`、敵が同じマスにいても味方が受ける）、
  敵だけなら相手ボール（`toEnemy`）、誰もいなければそのマスに **ルーズボール**（`loose`）。
- 用途: 味方の走り込み先に先に出す／相手が届かない場所へ逃がす／次ターンの拾い合いを仕掛ける。
  移動が先に解決されるため「味方が到達するマスへのスペースパス」は実質その味方へのパスになる。

### クロス
- 条件: 蹴り手の最終 x が `wideColumns`、受け手の最終 x が `centralColumns`、受け手が
  攻撃側エンドラインから `crossZoneRows=4` 行以内、距離 ≤ 6。満たさない場合は通常パスとして処理。
- コース上のインターセプトは発生しない（浮き球）。受け手がオフサイドなら無効（§オフサイド）。配球判定 `P = clamp(0.9 − 0.04·dist + (cross−50)/300, 0.3, 0.95)`、失敗でルーズボール。
- 成功時、受け手の 8 近傍および同じマスにいる敵のうち最も `aerial` の高い 1 人と **空中戦**:
  `P(受け手勝利) = clamp(0.5 + (aerialR − aerialD)/200 (+airBattler), 0.15, 0.85)`。
  敗北で守備側がボール獲得。勝利または非競合で、ゴール目標点まで ≤ 3.7（クロスゾーン全域をカバー）なら **ヘディングシュート**
  （`P = clamp(0.8 − 0.14·d + (aerial−50)/250, 0.05, 0.85)`、ブロック判定なし）、範囲外なら保持。

## 6. シュートとブロック

- 距離 `d` はシューターのマス中心からゴール目標点までのユークリッド距離。
- 使用ステータス: `d ≤ 2.5` なら `shoot`、`d ≥ 4.5` なら `longShot`、間は線形補間。
- `P(goal | 未ブロック) = clamp(0.92 − 0.11·d + (stat−50)/250, 0.03, 0.92) × (1 − 0.25·sinθ)`（θ は正面からの角度）。
  `oneTouch` 持ちは直前ターンにパスを受けていれば +0.12。
- **ブロック**: シューターからゴール目標点への線分上（`laneWidth 0.6`）の敵をシューターに近い順に判定。
  `P = clamp(0.95 − 0.2·(距離−1) + (block−50)/250 − 0.3·(オフセット/laneWidth), 0.05, 0.97)`（`blockMaster` +0.1）。
  直前 1 マスなら約 95%、2 マスで 75%、3 マスで 55%。ブロック成功でブロッカーがボール獲得。
  シューターと同じマスの敵（競り合いに負けた選手、§4.3）はブロックできない。
- 外れたシュートは **ゴールキック**: 守備側で自ゴールに最も近い選手が保持。
- UI はシュート選択時に `estimateShot` の値を「現在の守備位置基準の推定」と明示して表示する。

## 7. 得点・キックオフ・勝敗

- 得点後は両チームを初期配置へ戻し、**失点側**のスロット 0（ストライカー）がボールを持ってキックオフ。
- キックオフ時、**蹴らない側**のスロット 0 は自ゴール方向へ `kickoffGap=1` 行下げて配置する
  （両ストライカーが隣接して初手が運任せの競り合いになるのを防ぐ。実際のサッカーでも相手はセンターサークル外）。
- 試合開始は `MATCH.firstKickoff`（既定: 青）。
- 規定ターン（既定 20）終了で得点差により勝敗、同点は引き分け。前後半の入れ替えは行わない
  （青が常に上へ攻める方が UI が分かりやすく、プロトタイプ段階では十分）。

## 8. キャラクター（初期 5 種）

`src/game/data/characters.ts` 参照。移動と能力はデータ定義のみで追加可能。
スキルは `getEffectiveStats()` / 距離上限などに影響する受動効果としてフックしてあり、
初期実装は `counter`（奪取翌ターン移動 +1）、`oneTouch`、`airBattler`、`passMaster`、`blockMaster`。

## 9. AI（簡易）

- `planAiTurn(state, 'red', rng)` がルールモジュールの推定関数（`estimateShot` 等）を使って
  候補手をスコアリング。保持時: 期待得点が閾値以上ならシュート、より良い位置の味方へパス／クロス、
  それ以外は敵の隣接を避けつつ前進。非保持時: 最寄りの選手が保持者の「前進先」を予測して突撃、
  他はシュートライン／パスコースを塞ぐ位置へ。ルーズボールには最寄りが向かう。
- UI・ルールから分離されており、将来の対人戦では AI の代わりに相手の `TeamPlan` を差し込むだけでよい。

## 10. モジュール API 契約

```
src/game/types/index.ts          型定義（本書 §と 1:1）
src/game/rules/config.ts         BOARD / MATCH / RULES / goalTarget / forwardDir / otherTeam
src/game/data/characters.ts      CHARACTERS, getCharacter(id)
src/game/data/formations.ts      DEFAULT_FORMATION, formationPos(team, slot), mirrorPos
src/game/engine/rng.ts           createRng(seed), fixedRng(values), randomSeed()

src/game/rules/geometry.ts
  dist(a, b): number
  cellsOnSegment(from: Vec, to: Vec, laneWidth): {cell: Vec, offset: number, t: number}[]
    — 線分の両端の間 (0 < t < 1) にあり、垂直距離 ≤ laneWidth のマス
  laneOffset(p: Vec, from: Vec, to: Vec): { offset: number; t: number }
  inBounds(p: Vec): boolean
  neighbors8(p: Vec): Vec[]
  vecEq(a, b): boolean

src/game/rules/moves.ts
  legalMoveTargets(state, playerId): Vec[]      — 幾何的に到達可能なマス（現在地は含まない）
  availableMoveTargets(state, plan: TeamPlan, playerId): Vec[]
    — legalMoveTargets から、他の味方が予約済みのマスを除いたもの
  isLegalMove(state, playerId, to): boolean
  getEffectiveStats(state, player): Stats       — スキル補正込み
  effectiveMoveRangeBonus(state, player): number

src/game/rules/probability.ts   （純関数、rng を使わない）
  duelWinProbability(statA, statB, opts?: {carrierIsA?: boolean}): number
  passAccuracy(distance, passStat, skills): number
  interceptProbability(interceptStat, laneOffset): number
  crossDelivery(distance, crossStat): number
  aerialWinProbability(aerialR, aerialD, skillsR, skillsD): number
  headerGoalProbability(distance, aerialStat): number
  shotGoalProbability(distance, angleSin, stats: Stats, skills, ctx: {oneTouchActive}): number
  blockProbability(distanceFromShooter, laneOffset, blockStat, skills): number

src/game/rules/estimates.ts
  estimateShot(state, shooterId, fromPos?, defenderPositions?): ShotEstimate
  estimatePass(state, passerId, targetId, passerPos?, targetPos?, defenderPositions?): PassEstimate
  estimateCross(state, passerId, targetId, passerPos?, targetPos?, defenderPositions?): CrossEstimate
  isCrossValid(team, passerPos, targetPos): boolean
    — defenderPositions 省略時は現在の敵位置（UI 表示用の「推定値」）

src/game/engine/match.ts
  createMatch(options?: Partial<MatchConfig> & {formation?}): MatchState   — 初期配置、キックオフ
  kickoffState(state, kickoffTeam): MatchState
  getPlayer(state, id): PlayerState
  playersOf(state, team): PlayerState[]
  ballHolder(state): PlayerState | undefined
  playerAt(state, pos): PlayerState | undefined

src/game/engine/resolve.ts
  resolveTurn(state, plans: TurnPlans, rng): TurnResult
  resolveMovement(state, plans, rng): { positions: Record<PlayerId, Vec>, ball: BallState, events: TurnEvent[] }
  resolveBallAction(...)  （内部分割は実装に任せる）

src/game/engine/log.ts
  describeEvent(event, state): string   — 日本語の試合ログ 1 行

src/game/ai/simpleAi.ts
  planAiTurn(state, team, rng, options?: AiOptions): TeamPlan
```

## 11. UI 構成（1 画面・スクロールなし）

```
┌ HUD ───────────────────────────┐  スコア / ターン / 保持チーム / 残り時間 / メニュー
├ Pitch (SVG, flex:1) ───────────┤  7×10、10 人、保持者マーク、選択強調、移動可能マス、
│                                │  指定済み移動先と矢印、パス／シュート矢印
├ Controls (固定高) ─────────────┤  5 人のチップ（指定済み✓）/ 選手情報 /
│                                │  キープ・パス・クロス・シュート（推定%） /
└────────────────────────────────┘  リセット / ▶ ターン実行
```
- `height: 100dvh`、`env(safe-area-inset-*)` を考慮。試合ログは下から出るドロワー。
- 起動直後: 10 人配置済み、青のストライカーを初期選択、移動可能マスがハイライト済み。
- 初期化失敗時は ErrorBoundary ＋ `index.html` のフォールバックでエラー内容と再試行ボタンを表示。
