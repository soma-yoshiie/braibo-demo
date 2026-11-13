# BRAIBO（ブレイボ）設計仕様 v0.8

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
   0. （v0.8）有効なオフサイドトラップ宣言があれば、参加者が一歩前へ出る（§14.1）
   1. 移動の正規化（不正な移動は「その場」扱い）
   2. 全 10 人の同時移動。同チームの重なりを解消し、**ボールが絡むマスでだけ**競り合う（§4）
   3. ルーズボールの拾得（両チームが同時に入った場合は競り合い、§4）
   4. ボール行動（パス／クロス／シュート）— **移動後の最終位置で判定**
      （例外: 先出しスルーパスは移動の前に蹴る。§5）
   5. 得点処理 → キックオフ配置へリセット
   6. ターン数加算、規定ターン到達で試合終了。前半の最後のターンならハーフタイムの配置替え（§14.2）
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
- （先出しスルーパスが有効なときのスペースパスは判定の時点が違う。下の「先出しスルーパス」を参照。）
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

### スペースへのパス（スルーパス、`throughPass: 'legacy'` の挙動）
- 受け手ではなく **マス** を指定するパス。ゴロ／浮き玉のどちらでも出せ、距離上限・インターセプト判定は
  それぞれの種類に従う。精度は `spacePenalty=0.05` だけ低い。
- 精度判定成功後、移動後にそのマスに立っている選手が受け取る: 味方がいれば成功（`complete`、敵が同じマスにいても味方が受ける）、
  敵だけなら相手ボール（`toEnemy`）、誰もいなければそのマスに **ルーズボール**（`loose`）。
- 用途: 味方の走り込み先に先に出す／相手が届かない場所へ逃がす／次ターンの拾い合いを仕掛ける。
  移動が先に解決されるため「味方が到達するマスへのスペースパス」は実質その味方へのパスになる。

### 先出しスルーパス（v0.5、`throughPass: 'early'`、既定）
構想資料 01 の案 1。**スペースパスだけ「動く前に蹴る」**。蹴る瞬間（オフサイド判定）と受ける瞬間を分け、
オンサイドから走り出してラインの裏で受ける動きを成立させる。足元へのパスとクロスは従来どおり移動後に蹴る。

- **新旧の切り替え**: 試合ごとの設定 `MatchState.throughPass`（`'early'` | `'legacy'`）。省略時は
  `RULES.throughPass.defaultMode`。読むときは必ず `throughPassMode(state)` を使う。`createMatch({ throughPass })` で指定する。
  `'legacy'` では上の「スペースへのパス」と「オフサイド」の記述がそのまま有効（v0.4 と完全に同じ挙動、乱数の消費順も同じ）。
- 以下は `'early'` で、ボール行動が `spacePass` のターンの処理。処理順は **キック → 移動 → 受け**。
  1. **キック（移動前、ターン開始時の位置）**
     - 蹴り手はターン開始時の位置から蹴る。**蹴り手はそのターン移動しない**（移動の指定は無視され、「その場に留まる者」として扱う）。
     - 目標マスが盤外／蹴り手のマス、または開始位置からの距離が上限超過なら、キックは行わず
       **キープ扱いの通常ターン** として処理する（蹴り手の移動指定も有効、競り合いも通常どおり）。
       `actionCancelled` は legacy と同じ扱い: 移動のあとも蹴り手がボールを持っている場合にだけ、移動イベントの後ろに出す。
     - コース上のインターセプト判定は **ターン開始時の敵の位置** で行う（ゴロ／浮き玉の対象範囲は通常のパスと同じ）。
       目標マスにいる敵（密着マーク）はここでは判定しない。蹴り手と同じマスの敵は対象外（§4.3）。
     - 続けて精度判定（`passAccuracy − spacePenalty`）。
  2. **移動**: 全員が同時に移動する。ボールは空中／転がっている最中なので **保持者はいない**。
     このターンは §4.2 のボールを巡る競り合いは起きない（蹴り手のマスへ敵が入っても何も起きない）。同チームの重なり（§4.1）は通常どおり。
  3. **受け（移動後の位置）**
     - キックでインターセプトされていた → その選手のボール（`intercepted`、`wonBallTurn`）。移動後の位置で持つ。
     - 精度判定に失敗していた → 目標マスの隣の空きマスへルーズボール（`failed`、`scatter`、移動後の位置で空きを判定）。
     - 目標マスに味方がいる → その味方が **ターン開始時にオフサイドポジション** だったなら **オフサイド**
       （ボールは受け手に最も近い守備側選手へ、`offside` イベントに `early: true`。
       判定は開始位置だが、「最も近い」は受け手と守備側の **移動後の位置** で測る）。
       オンサイドなら、同じマスに敵もいる場合だけ密着マークの判定を 1 回（オフセット 0、ゴロ `intercept`／浮き玉 `aerial`）。
       通れば味方が受ける（`complete`、`receivedPassTurn`）。マークに取られた場合は `intercepted`（`interceptorId` がその選手、
       `marked: true` を付けて、コース上のカットと区別する）。
       **1 人の守備者が判定を受けるのは 1 ターンに 1 回まで**。キックの時点でコース上の判定を受けて外した選手が
       目標マスへ入っていても、密着マークの判定は行わず味方が受ける。
     - 敵だけがいる → 相手ボール（`toEnemy`）。誰もいない → 目標マスにルーズボール（`loose`）。
- **オフサイドの判定基準（early のスペースパス）**: 受け手・ボール（蹴り手）・守備側の全員について **ターン開始時の位置** を使う。
  つまり計画中に画面に見えているラインがそのまま判定線になる。条件 (1)〜(3) は上と同じ。
- **乱数の消費順（early のスペースパス）**: コース上のインターセプト（蹴り手に近い順、成功で打ち切り）→ 精度 →
  （移動: 消費なし）→ 失敗時の `scatter` 1 個、または密着マーク 1 個。
- **イベント順**: `(bounce | displace)* → move* → pass | offside`。`pass` と `offside` には `early: true` が付き、
  `from` は蹴り手の開始位置。UI はこれを見て「蹴ってから全員が動く」演出にする。
- **予測値**: `estimateThroughPass(state, passerId, target, style, receiverId?)`。現在位置だけで計算するので、
  `pComplete` は「目標マスへ正確に届く確率」の **確定値**（従来の推定値と違い、相手の移動で変わらない）。
  目標マスでの奪い合いは含まない。`receiverId` を渡すと、その選手が今オフサイドポジションかを `offside` に入れる（`pComplete = 0`）。
- **理由**: 現行ルールは蹴る瞬間と受ける瞬間が同じで、裏で受けるパスは定義上オフサイドになり、守備はラインを上げ続けるのが正解だった。
  分けることで四すくみができる。スルーパスはライン上げに強い／カバー（下がって目標マスに先に入る）はスルーパスに強い／
  足元パスとドリブルはカバーに強い／ライン上げと寄せは足元パスに強い。
  コースの判定を開始位置にしたのは、ボールが全員より先に出るという絵と一致させるためと、蹴る側が計画中に危険を正確に読めるようにするため。
  守備側の対抗手段は「コースに立っておく（次のターンへの備え）」と「落下点へ先に入る」の 2 つ。
  代償は、蹴り手が動けないことと `spacePenalty`、そして目標マスが相手にも拾えること。
- **確かめる指標**（`npm run sim`、AI 同士 200 試合）: オフサイド 1〜3 回／試合、得点 2.5〜4 点／試合、
  スルーパス成功率 30〜45%、裏抜けからの得点の割合 20〜35%。

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
- 規定ターン（既定 20）終了で得点差により勝敗、同点は引き分け。
- v0.8 から前後半制（§14.2）。攻める向きは入れ替えない（青が常に上へ攻める方が UI が分かりやすい）。

## 8. キャラクター（初期 5 種）

`src/game/data/characters.ts` 参照。移動と能力はデータ定義のみで追加可能。
スキルは `getEffectiveStats()` / 距離上限などに影響する受動効果としてフックしてあり、
初期実装は `counter`（奪取翌ターン移動 +1）、`oneTouch`、`airBattler`、`passMaster`、`blockMaster`。

## 9. AI（簡易）

- `planAiTurn(state, 'red', rng)` がルールモジュールの推定関数（`estimateShot` 等）を使って
  候補手をスコアリング。保持時: 期待得点が閾値以上ならシュート、より良い位置の味方へパス／クロス、
  それ以外は敵の隣接を避けつつ前進。先出しスルーパスが有効なら、今オンサイドの味方を裏へ走らせて
  その到達マスへスルーパスを出す組み合わせも候補にする。非保持時: 最寄りの選手が保持者の「前進先」を予測して突撃、
  他はシュートライン／パスコースを塞ぐ位置へ。ルーズボールには最寄りが向かう。
  先出しスルーパスが有効なら、最後尾は「上げる」と「下がって裏をカバーする」を状況と乱数で使い分ける（毎ターン同じ手にしない）。
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

  estimateThroughPass(state, passerId, target, style?, receiverId?): PassEstimate
    — 先出しスルーパス用。現在位置だけで計算する確定値（§5）
  laneInterceptors(state, defs, from, to, style, opts?: { markers?: boolean })
    — markers: false で目標マスの密着マークを除く（先出しスルーパスのキック時）

src/game/rules/config.ts
  throughPassMode(state): 'early' | 'legacy'   — state.throughPass ?? RULES.throughPass.defaultMode

src/game/engine/match.ts
  createMatch(options?: Partial<MatchConfig> & {formation?, throughPass?}): MatchState   — 初期配置、キックオフ
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

scripts/sim.ts   （`npm run sim -- [試合数=200] [seed=1] [early|legacy|both] [trap=on|off|both] [halves=on|off|both]`）
                 列 = スペースパスのルール × トラップ × 前後半。既定は early・trap=both・halves=on。
                 宣言回数、的中率、byTrap の内訳（足元／スルー／クロス）、前後半別の得点、宣言ターンの足元パス／スルーパス成功率も出す。
  AI 同士の対戦を legacy / early の両方で回し、§5 の指標を表で出す
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

## 12. 選手名鑑・編成・スカウト・セーブ（v0.6、試合ルールの外側）

試合ルール（§1〜§9）は変えない。ここは「どの選手で試合をするか」と、アプリとしての外側のデータを決める。
乱数は従来どおり注入する。ストレージ（`localStorage`）に触るのは `src/meta/store.ts` だけ。

### 12.1 選手名鑑（`src/game/data/roster.ts`）
- 既存の `CHARACTERS` 5 種は **ロールの原型**（id: `striker` など）として残す。テスト、`DEFAULT_FORMATION`、`npm run sim` はこれを使い続ける。
- 名前のある選手は `ROSTER: CharaProfile[]` に置く。`getCharacter(id)` は名鑑の id も解決し、
  `CharacterDef` を「原型（同じロール）の moves / skills / abbr / description ＋ `name = profile.name` ＋ `stats = clamp(原型 + bonus, 1, 99)`」で返す。
- `getProfile(charId)`: 名鑑の選手はその `CharaProfile`。原型の id を渡したときは、同じロールの ★3 の初期選手の見た目を借りた
  既定のプロフィール（`name` は原型の名前）を返す。UI は必ず表示できる。

```ts
export type Rarity = 3 | 4 | 5;
export type HairId = 'spiky' | 'windswept' | 'bowl' | 'swept' | 'crop' | 'long' | 'ponytail' | 'mohawk' | 'curly' | 'slick';
export type EyeId = 'sharp' | 'stern' | 'round' | 'narrow';
export type ExtraId = 'none' | 'headband' | 'glasses' | 'bandage' | 'scar';
export interface CharaLook { hair: HairId; hairColor: string; hairHi: string; skin: 'fair' | 'tan' | 'brown'; eyes: EyeId; eyeColor: string; extra: ExtraId }
export interface CharaProfile {
  id: string; role: RoleId; name: string; title: string; rarity: Rarity; number: number;
  group: 'player' | 'rival';            // rival = 紅蓮の固定メンバー。スカウトには出ない
  quotes: { duel: string; goal: string; lose: string };
  look: CharaLook; bonus: Partial<Stats>;
}
export const ROSTER: CharaProfile[];
export const STARTER_IDS: Record<RoleId, string>;   // 最初から持っている ★3 の 5 人
export const RIVAL_LINEUP: string[];                // スロット順（ST, WG, LS, IC, DF）= DEFAULT_FORMATION の順
export const SCOUT_POOL: CharaProfile[];            // group === 'player' の 15 人
export const ROLE_ORDER: RoleId[];                  // ['striker','wing','longShooter','interceptor','physicalDefender']
```

| id | ロール | ★ | 名前 | 二つ名 | # | 髪 / 色 | 目 / 色 | 肌 | 小物 | bonus |
|---|---|---|---|---|---|---|---|---|---|---|
| st_kakeru | ST | 3 | 天宮カケル | 一直線のエース | 9 | spiky #2456d6 | sharp #2a7bff | fair | none | なし |
| st_raiga | ST | 4 | 雷堂ライガ | 雷鳴のストライカー | 11 | mohawk #f2c21b | sharp #ff8a00 | tan | scar | shoot+5 physical+5 aerial+2 |
| st_ouga | ST | 5 | 皇オウガ | 絶対王者 | 10 | slick #e9e4f5 | narrow #c9a227 | fair | none | shoot+9 aerial+9 physical+4 longShot+4 |
| wg_sora | WG | 3 | 風間ソラ | 疾風のサイドアタッカー | 7 | windswept #1f9ad6 | round #1f9ad6 | fair | none | なし |
| wg_tsubame | WG | 4 | 鳥居ツバメ | 燕返しのクロッサー | 17 | ponytail #24304f | sharp #7c5cff | fair | none | cross+5 pass+5 shoot+2 |
| wg_hayate | WG | 5 | 天羽ハヤテ | 影を置き去る翼 | 14 | long #35d0a5 | narrow #19b38a | tan | headband | cross+9 pass+9 shoot+4 intercept+4 |
| ls_taiga | LS | 3 | 岩城タイガ | 遠距離砲 | 18 | bowl #3b4a7a | round #3b4a7a | fair | glasses | なし |
| ls_iori | LS | 4 | 鷹見イオリ | 鷹の目スナイパー | 8 | swept #8a5a2b | narrow #b9772f | tan | none | longShot+5 pass+5 shoot+2 |
| ls_kou | LS | 5 | 星乃コウ | 流星キャノン | 20 | curly #ff7ab8 | round #ff4f9a | fair | none | longShot+8 shoot+9 pass+4 physical+4 |
| ic_shinobu | IC | 3 | 霧島シノブ | 読みの番人 | 6 | swept #4b3fae | stern #6a5cff | fair | none | なし |
| ic_jin | IC | 4 | 夜鷹ジン | パスコースの狩人 | 5 | crop #1b1d2b | stern #d83a3a | brown | bandage | intercept+5 physical+5 pass+2 |
| ic_rei | IC | 5 | 白瀬レイ | 先読みの氷刃 | 16 | long #cfe9ff | narrow #58b8ff | fair | none | intercept+8 pass+9 physical+4 block+4 |
| df_daigo | DF | 3 | 鉄山ダイゴ | 不動の壁 | 4 | crop #2b3550 | stern #2b3550 | tan | headband | なし |
| df_gou | DF | 4 | 熊谷ゴウ | 空中戦の番長 | 3 | mohawk #7a3b1e | stern #a34a1a | brown | none | aerial+5 physical+5 block+2 |
| df_genbu | DF | 5 | 城戸ゲンブ | 難攻不落の城 | 2 | slick #1f6f5c | stern #2bb38f | tan | scar | block+9 physical+8 aerial+4 intercept+4 |
| rv_enji | ST | 3 | 火野エンジ | 紅蓮の点取り屋 | 9 | spiky #c8102e | sharp #ff3b3b | fair | none | なし |
| rv_homura | WG | 3 | 朱堂ホムラ | 火走りのウイング | 7 | windswept #e2562a | round #ff6a2a | tan | none | なし |
| rv_kagari | LS | 3 | 焔カガリ | 灼熱の砲手 | 10 | bowl #8f1d2c | round #8f1d2c | fair | glasses | なし |
| rv_ren | IC | 3 | 赤城レン | 焦がす読み | 6 | swept #b3261e | stern #ff5a3c | fair | none | なし |
| rv_gantetsu | DF | 3 | 不破ガンテツ | 燃える鉄壁 | 4 | crop #5a1418 | stern #b81224 | brown | headband | なし |

`hairHi` は髪色を明るくした色（実装側で決めてよい）。セリフ（`quotes`）は各選手 3 本、20 字以内、その選手の二つ名に合う
オリジナルの文にする。**既存の漫画・アニメ・ゲームの人物名、セリフ、見た目を借りない**。名前と見た目は仮の設定。

### 12.2 編成（`createMatch` の `lineups`）
- `CreateMatchOptions.lineups?: Partial<Record<TeamId, string[]>>`。スロット `i` の選手を `lineups[team][i]` にする
  （なければ formation の `charId`）。位置は従来どおり formation から決まる。
- プレイヤーの編成は **ロールごとに 1 人**（ST / WG / LS / IC / DF）。そのロールで所持している選手から選ぶ。
  ロールが変わらないので、移動の形、スキル、AI の評価、フォーメーションはそのまま使える。
- 赤（AI）は `RIVAL_LINEUP`。全員が原型と同じ能力。

### 12.3 セーブ（`src/meta/save.ts`、純関数）
```ts
export interface SaveSettings { timerOn: boolean; throughEarly: boolean; cutIn: boolean }
export interface SaveData {
  v: 1; coins: number;
  owned: Record<string, number>;         // charId → 引いた回数（1 以上で所持）
  lineup: Record<RoleId, string>;
  settings: SaveSettings;
  record: { played: number; won: number; drawn: number; lost: number };
  pulls: number;
}
export function defaultSave(): SaveData;                 // coins = META.startCoins、初期 5 人を所持・編成
export function parseSave(raw: unknown): SaveData;       // 壊れた値は既定値で補う。未所持や別ロールの編成は初期選手へ戻す
export function lineupIds(save: SaveData): string[];     // スロット順
export function setLineup(save: SaveData, role: RoleId, charId: string): SaveData; // 所持かつロール一致のときだけ変える
export function matchReward(score: Record<TeamId, number>): { result: 'win' | 'draw' | 'lose'; coins: number };
export function applyMatchResult(save: SaveData, score: Record<TeamId, number>): SaveData;
```
`src/meta/store.ts`: `saveStore.get() / update(fn) / reset() / subscribe(cb)` と React 用の `useSave()`。
キーは `braibo.save.v1`。読み書きは try/catch で囲み、失敗したらメモリ上だけで動く。

### 12.4 スカウト（ガチャ、`src/meta/gacha.ts`、純関数）
- **使うのはゲーム内コインだけ**。課金、購入、外部送信はない。コインは試合の報酬で増える。
- 調整値は `src/meta/config.ts` の `META`:
  `startCoins: 3000`、`gacha.cost1: 100`、`gacha.cost10: 1000`、`gacha.rates: {5: 0.03, 4: 0.17, 3: 0.80}`、
  `gacha.guaranteedMin10: 4`、`gacha.dupRefund: {3: 10, 4: 40, 5: 150}`、`reward: {win: 300, draw: 150, lose: 100}`。
- 抽選: 乱数 1 個で ★ を決め、もう 1 個でその ★ の中から等確率に 1 人。10 連の 10 人目は ★4 以上確定
  （★4 と ★5 の比は `rates` の比のまま、85% / 15%）。
- 重複: すでに持っている選手は `owned` を +1 し、★ に応じたコインを返す。同じ 10 連の中の 2 人目以降も重複扱い。
- 提供割合は画面でいつでも見られる（通常枠、確定枠、選手ごとの値）。`gachaRates()` が表示用の表を返す。

```ts
export interface PullResult { charId: string; rarity: Rarity; isNew: boolean; refund: number }
export function canPull(save: SaveData, count: 1 | 10): boolean;
export function rollGacha(rng: Rng, count: 1 | 10): string[];
export function applyGacha(save: SaveData, charIds: string[], cost: number): { save: SaveData; results: PullResult[] };
export function gachaRates(): { slot: 'normal' | 'guaranteed'; rows: { rarity: Rarity; rate: number; each: number; ids: string[] }[] }[];
```

## 13. ランク・ステージ・強化・ミッション・ログインボーナス（v0.7、試合ルールの外側）

国内のスマホゲーム（パズドラなど）でおなじみの「続けて遊ぶ理由」を足す。参考にするのは **仕組みの型** だけで、
名前、絵、画面の見た目、文言は借りない。試合ルール（§1〜§9）は変えない。乱数と日付は注入する
（純関数は `today: string`（`YYYY-MM-DD`）を引数で受け取る。`Date` に触るのは `src/meta/store.ts` と UI だけ）。
調整値はすべて `src/meta/config.ts` の `META`。

### 13.1 強化値つきの選手 id（`+n`）
- 選手 id の末尾に `+n`（n は 1〜20 の整数）を付けると、**全能力 +n（上限 99）** の選手になる。例: `st_kakeru+3`、`rv_enji+6`。
- `getCharacter('x+n')` は `getCharacter('x')` の stats に n を足したもの（id は `x+n`、名前などは同じ）。
  `getProfile('x+n')` は `getProfile('x')` と同じ内容で `id` だけ `x+n`。
- `splitCharId(id): { base: string; plus: number }` と `withPlus(base, n): string`（n = 0 なら base のまま）を `roster.ts` から出す。
- 試合に渡す `lineups` はこの形の id を使う。セーブの `owned` / `lineup` / `levels` のキーは **base の id** のまま。

### 13.2 セーブ v2（`src/meta/save.ts`）
保存キーは `braibo.save.v1` のまま。`parseSave` は v1 のデータを読み、足りない項目を既定値で補って `v: 2` にする。
```ts
export interface SaveData {
  v: 2; coins: number;
  owned: Record<string, number>; lineup: Record<RoleId, string>;
  levels: Record<string, number>;                 // base id → Lv（1〜META.level.max）。ない選手は Lv1
  settings: SaveSettings;
  record: { played: number; won: number; drawn: number; lost: number; goals: number };
  pulls: number; levelUps: number;
  rank: number; exp: number;                      // exp は今のランクでためた分
  stages: Record<string, { cleared: boolean; bestDiff: number | null }>;   // bestDiff = 最高の得失点差
  daily: { date: string; played: number; won: number; pulls: number; claimed: string[] };
  claimed: string[];                              // 受け取り済みの通常ミッション id
  login: { lastDate: string; day: number };       // day = これまでに受け取った日数
}
```
- `lineupIds(save)` はスロット順に **`+(Lv-1)` を付けた id** を返す（Lv1 は base のまま）。
- `teamPower(charIds: string[]): number` = 5 人の 8 能力の合計（`+n` 込み）。表示用の「総合力」。

### 13.3 ランクと経験値
- 試合ごとの経験値: `META.exp = { win: 100, draw: 60, lose: 40, perGoal: 10 }`（ゴールは自分の得点）。
- 次のランクまで: `META.rank.base + META.rank.step * (rank - 1)`（既定 `base: 100`, `step: 50`）。あふれた分は次へ持ち越す。
- ランクが上がるたびに `META.rank.bonusCoins`（既定 200）コイン。

### 13.4 強化（レベル）
- 所持している選手だけ。`META.level = { max: 6, costs: [200, 400, 600, 800, 1000] }`（`costs[Lv-1]` が次の Lv への費用）。
- 1 レベルにつき全能力 +1（§13.1 の `+n` で試合に反映）。Lv6 で +5。
- `canLevelUp(save, baseId)` / `levelUp(save, baseId): SaveData`（できないときは同じオブジェクトを返す）。`levelUps` を +1。

### 13.5 ステージ（`src/meta/stages.ts`）
相手は「紅蓮」の同じ 5 人で、ステージが進むほど強化値が上がる。AI の考え方は同じ。
```ts
export interface StageDef { id: string; no: number; name: string; note: string; plus: number; stars: 1|2|3|4|5; firstClear: number }
export const STAGES: StageDef[];
export function stageLineup(stage: StageDef): string[];                 // RIVAL_LINEUP に +plus
export function isUnlocked(save: SaveData, stageId: string): boolean;   // 1 つ前をクリア済み、または最初のステージ
export function nextStage(save: SaveData): StageDef;                    // まだクリアしていない最初のステージ（全部済みなら最後）
```
| id | no | name | note | plus | stars | firstClear | rewardMul |
|---|---|---|---|---|---|---|---|
| s1 | 1 | 練習試合 | まずは 1 勝 | 0 | 1 | 300 | 1.0 |
| s2 | 2 | 地区予選 | 相手が少し手強い | 1 | 2 | 400 | 1.2 |
| s3 | 3 | 地区決勝 | 相手の能力が上がる | 3 | 3 | 600 | 1.4 |
| s4 | 4 | 全国大会 | 強化して挑みたい | 5 | 4 | 800 | 1.7 |
| s5 | 5 | 紅蓮・本気 | 相手の全力 | 7 | 5 | 1200 | 2.0 |
- `rewardMul`: 試合の報酬コイン（`META.reward`）に掛ける倍率（四捨五入）。進んだステージほど報酬が多く、最初のステージの周回が最善にならない。
  `StageDef` に `rewardMul: number` を足す。`summarizeMatch` / `applyMatchResult` の `coins` に反映する。経験値には掛けない。
- 強化値は「最強の編成（★5 を 5 人、Lv6、総合力 2500）がステージ 5（2465）を上回れる」範囲に収めた。
- **計測（AI 同士 300 試合）では、能力値の差は勝率を 5〜10 ポイントしか動かさない**（構想資料 03 と v0.7 の QA）。
  ステージの難しさは今のところ目安の表示に近い。本当に難しくするには AI の強さかルール側で差を付ける（オーナーの判断待ち）。
- クリア = そのステージで勝つ（引き分けは未クリア）。初クリアのときだけ `firstClear` コイン。何度でも再戦できる。

### 13.6 試合結果のまとめ
```ts
export interface ResultSummary {
  result: 'win' | 'draw' | 'lose';
  coins: number;            // 試合の報酬（META.reward）
  firstClear: number;       // 初クリアのコイン（なければ 0）
  expGain: number;
  rankBefore: number; rankAfter: number; expBefore: number; expAfter: number; expNeedAfter: number;
  rankUpCoins: number;      // ランクアップで得たコインの合計
  totalCoins: number;       // coins + firstClear + rankUpCoins
}
export function summarizeMatch(save: SaveData, stageId: string, score: Record<TeamId, number>): ResultSummary;   // 保存しない
export function applyMatchResult(save: SaveData, stageId: string, score: Record<TeamId, number>, today: string): SaveData;
```
`applyMatchResult` は戦績、ゴール数、コイン、経験値とランク、ステージの記録、デイリーの回数をまとめて更新する。
`summarizeMatch` の値と必ず一致すること（テストで確かめる）。`matchReward(score)` は残す。

### 13.7 ミッション（`src/meta/missions.ts`）
```ts
export interface MissionDef { id: string; kind: 'daily' | 'normal'; title: string; goal: number; reward: number }
export interface MissionState { def: MissionDef; progress: number; done: boolean; claimed: boolean }
export const MISSIONS: MissionDef[];
export function rolloverDaily(save: SaveData, today: string): SaveData;        // 日付が変わっていたら daily を空にする
export function missionStates(save: SaveData, today: string): MissionState[];
export function claimMission(save: SaveData, id: string, today: string): SaveData;   // 達成済み・未受け取りのときだけ
export function claimAllMissions(save: SaveData, today: string): { save: SaveData; coins: number };
export function claimableCount(save: SaveData, today: string): number;
```
| id | kind | title | goal | reward | 進み具合の元 |
|---|---|---|---|---|---|
| d_play | daily | 試合を 1 回する | 1 | 100 | daily.played |
| d_win | daily | 試合に 1 回勝つ | 1 | 150 | daily.won |
| d_scout | daily | スカウトを 1 回引く | 1 | 50 | daily.pulls |
| n_win1 | normal | 初勝利 | 1 | 300 | record.won |
| n_win5 | normal | 通算 5 勝 | 5 | 500 | record.won |
| n_goal10 | normal | 通算 10 ゴール | 10 | 300 | record.goals |
| n_own10 | normal | 選手を 10 人集める | 10 | 500 | 所持人数 |
| n_lv | normal | 選手を 1 回強化する | 1 | 200 | levelUps |
| n_s3 | normal | 地区決勝をクリア | 1 | 500 | stages.s3.cleared |
| n_s5 | normal | 紅蓮・本気をクリア | 1 | 1000 | stages.s5.cleared |
スカウトを引いたら `daily.pulls` を増やす（`applyGacha` に `today` を足す: `applyGacha(save, charIds, cost, today)`）。

### 13.8 ログインボーナス
- 1 日 1 回。`META.login.coins = [100, 100, 150, 150, 200, 200, 500]` を 7 日で一巡（`day % 7`）。連続でなくてよい。
- 端末の日付が **前に進んだときだけ** 新しい日として扱う（`today > lastDate`、`today > daily.date` の文字列比較）。
  日付が戻った場合は、ログインボーナスもデイリーの巻き戻しも起こさない（日付を行き来して何度も受け取れないようにする）。
- `loginBonus(save, today): { day: number; coins: number } | null`（今日まだなら次にもらえる内容）と `claimLogin(save, today): SaveData`。

### 13.9 課金について
コインはすべてゲーム内で手に入る。購入、広告、外部送信、スタミナ（遊べる回数の制限）は入れない。

## 14. オフサイドトラップ宣言と前後半（v0.8、構想資料 03 の STEP 1）

### 14.1 オフサイドトラップ宣言
構想資料 01 の案 2。守備に「ラインを一斉に上げる」という能動的な一手を足す。当たれば反則を取れ、外せば最終ラインが動けない。

- **切り替え**: 試合ごとの設定 `MatchState.trap?: boolean`。省略時は `RULES.trap.enabled`（既定 true）。読むときは `trapEnabled(state)`。
  `createMatch({ trap })` で指定する。false のときは v0.7 までと完全に同じ挙動（乱数の消費順も同じ）。
- **宣言できる条件**: 作戦フェーズの時点で **相手がボールを持っている** こと（自分のボール、ルーズボールのときは不可）、
  かつ再宣言の待ちが明けていること。条件を満たさない宣言は無視する（イベントも出さない）。`canDeclareTrap(state, team)`。
- **宣言**: `TeamPlan.trap?: boolean`。
- **参加者**: 宣言したチームの **最後尾の行にいる選手全員**（青は y が最大の行、赤は最小の行）。`trapParticipants(state, team)`。
- **処理（ターンの最初、先出しスルーパスのキックより前）**:
  1. 参加者はそれぞれ **1 マス前へ出る**（青は y−1、赤は y+1）。前のマスに味方がいる、またはボール保持者がいる場合、
     その選手だけは出ない（参加者ではあるので、2 は適用する）。敵（保持者以外）とは同じマスに並べる。競り合いは起きない。乱数は使わない。
  2. 参加者はそのターン **ほかの移動ができない**（移動の指定は無視）。以降は「その場に留まる者」として扱う。
     ボール保持者がそのマスへ入ってくれば通常どおり競り合う。
  3. 以降の処理はすべて **前へ出たあとの位置** を使う。先出しスルーパスの「ターン開始時の位置」（オフサイド、コース上のカット）は
     「トラップの一歩を適用したあとの位置」と読み替える。足元へのパスとクロスは従来どおり移動後の位置で判定する（参加者は前に出たまま）。
- **再宣言の待ち**: 宣言したターンの次から `RULES.trap.cooldown`（既定 2）ターンは宣言できない。
  `MatchState.trapReady?: Record<TeamId, number>`（そのターン番号以降に宣言できる。ない場合は 1）。得点後のキックオフでは戻さない。ハーフタイムで戻す。
- **イベント**: 有効な宣言があれば、イベント列の **先頭** に
  `{ type: 'trap'; team: TeamId; steps: { playerId: PlayerId; from: Vec; to: Vec }[] }`（出なかった参加者は `from` と `to` が同じ）。
  両チームが同時に宣言することはない（宣言できるのは守備側だけ）。
  `offside` イベントに `byTrap?: true` を足す: 参加者を一歩戻した位置で判定し直すとオンサイドになる場合（= 宣言が反則を作った）。
- **予測値**: 作戦中の表示は相手の宣言を知らない前提のまま。`estimateThroughPass` などは変えない。
- **読み合い**: 宣言は「上がったあとのラインより前で受けるパス」すべてに効く。
  ラインと並ぶ位置で受ける足元パスとクロス、ライン上の選手を走らせるスルーパスは反則になる。
  ラインより手前で受ける足元パス、1 列後ろから飛び出すスルーパス、ドリブルは宣言に勝つ（上がったラインは動けない）。
  **計測では、宣言で取れる反則の約 99% は足元パスとクロス**（受け手が最終ラインと並んでいる場面）で、スルーパスはほぼない。
  構想資料 03 A1 の表は「足元パスは宣言に勝つ」としていたが、それが成り立つのはラインより手前で受ける場合だけ。
- **AI**:
  - 守備時: 宣言できるとき、相手に「最後尾の行と同じ行、または 1 つ手前の行にいて、一歩で反則にできる選手」がいて、
    保持者からスルーパスが届く位置関係なら、重みに応じて宣言する。毎回は宣言しない（読まれないよう、乱数で散らす）。
  - 攻撃時: 相手が宣言できる状況では、ライン上の選手を走らせるスルーパスの評価を下げ（`trapRisk`）、1 列後ろからの飛び出しを少し上げる（`trapBehind`）。
    一歩上がったラインで反則になる位置（ラインと並ぶ位置）で受ける足元パスとクロスも割り引く（`trapFootRisk`）。
    禁止ではなく割引なので、AI も読み違えて掛かることがある。
  - 重みは `AI_WEIGHTS`（`trapBase 0.05`, `trapScale 0.3`, `trapMax 0.6`, `trapNear 0.2`, `trapRisk 0.2`, `trapLevelOff 0.05`, `trapBehind 0.1`, `trapFootRisk 0.06`）。
    守備側は「一歩で反則にできる相手」がいるときだけ、`min(trapMax, trapBase + trapScale × 脅威)` の確率で宣言する。
- **計測**（AI 同士 400 試合、先出しスルーパス、前後半あり。seed 1 / seed 2）:

  | 指標 | トラップあり | トラップなし | 目安 |
  |---|---|---|---|
  | オフサイド／試合 | 1.10 / 1.15（うち宣言による 0.64 / 0.63） | 0.79 / 0.79 | 1〜3 |
  | 宣言／試合（両チーム計） | 1.94 / 1.93 | なし | 1〜4 |
  | 宣言の的中率 | 32.8% / 32.7% | なし | 見立ては 40〜60% |
  | スルーパス成功率 | 42.7% / 40.6% | 45.8% / 48.7% | 30〜45% |
  | 足元パス成功率（宣言のターン） | 18.7% / 23.7% | なし | なし |
  | 得点／試合 | 2.85 / 2.69 | 2.67 / 2.68 | 2.5〜4 |
  | 勝ち 青 / 赤 / 引き分け | 37.5 / 40.5 / 22.0%、40.5 / 36.8 / 22.8% | 37.0 / 36.8 / 26.3%、40.3 / 37.5 / 22.3% | 偏らない |

  - 的中率は見立てに届いていない。`trapFootRisk` を 0 にすると 38.8% まで上がるが、AI が毎回ラインに並んで掛かる。
    0.3 まで上げるとオフサイドが 0.44 回に減り、宣言が当たらなくなる。0.06 は両方の seed でオフサイド 1 回以上を保てる上限。
  - 「毎回宣言する」は得にならない（的中率 15%、失点が 1 試合 0.15〜0.25 点増える。QA の計測）。
  - 両方の切り替えを OFF にすると v0.7 と 1 手も違わない（400 試合で確認）。

### 14.2 前後半
- **切り替え**: `MatchState.halves?: boolean`。省略時は `MATCH.halves`（既定 true）。`halvesEnabled(state)`。`createMatch({ halves })`。
  false のときは v0.7 までと同じ。
- 前半は `halfTurns(state) = floor(maxTurns / 2)` ターン（既定 10）。`halfOf(state): 1 | 2`（`turn <= halfTurns` なら 1）。
- **ハーフタイム**: 前半の最後のターンを解決したあと（試合が続く場合）、両チームを初期配置へ戻し、
  **前半のキックオフを取らなかった側** のボールで後半を始める。フラグ（`receivedPassTurn` など）と `trapReady` は戻す。
  得点は持ち越す。攻める向きは入れ替えない。
- `MatchState.firstKickoff?: TeamId`（`createMatch` が入れる。ない場合は `MATCH.firstKickoff`）。
- **イベント**: そのターンのイベント列の最後に `{ type: 'halfTime'; score: Record<TeamId, number>; kickoffTeam: TeamId }`。
  前半の最後のターンに得点があった場合は、`goal` → `kickoff` の代わりに `goal` → `halfTime`（キックオフは後半の側）。
- `TurnResult.afterAction` はハーフタイムの配置替えの前、`after` は配置替えのあと。
- **計測**: 後半の頭で配置を戻すぶん、後半の得点が 1 試合あたり 0.2〜0.25 点減る（前半 1.34 / 後半 1.34。v0.7 は 1.33 / 1.58）。
  先にキックオフする側の有利、引き分け、逆転の割合は v0.7 と誤差の範囲。

### 14.3 API の追加
```ts
// types
TeamPlan.trap?: boolean
MatchState.trap?: boolean; MatchState.trapReady?: Record<TeamId, number>; MatchState.halves?: boolean; MatchState.firstKickoff?: TeamId
TurnEvent |= { type: 'trap'; team; steps } | { type: 'halfTime'; score; kickoffTeam }      // offside に byTrap?: true
// rules / engine
trapEnabled(state); halvesEnabled(state); halfTurns(state); halfOf(state)
canDeclareTrap(state, team): boolean; trapParticipants(state, team): PlayerState[]; trapWait(state, team): number   // あと何ターンで宣言できるか（0 = できる）
createMatch({ trap?, halves? })
// meta
SaveSettings.trap: boolean   // 既定 true。parseSave は欠けていたら true で補う
```
`describeEvent` は `trap` と `halfTime` の文を返す（「紅蓮がオフサイドトラップ！」「前半終了 1-0」）。`byTrap` のオフサイドは「（トラップ成功）」を添える。
`npm run sim` は宣言回数、的中率、前後半別の得点を出し、`trap` の有無を並べて比べられるようにする。
