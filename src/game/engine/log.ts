import type { MatchState, PlayerId, TeamId, TurnEvent, Vec } from '../types';
import { getCharacter } from '../data/characters';

const TEAM_LABEL: Record<TeamId, string> = { blue: '蒼嵐', red: '紅蓮' };
const pos = (v: Vec) => `(${v.x},${v.y})`;

function name(state: MatchState, id: PlayerId): string {
  const p = state.players.find((q) => q.id === id);
  if (!p) return id;
  return `${TEAM_LABEL[p.team]} ${getCharacter(p.charId).name}`;
}

/** One Japanese log line per event. Plain `move` events are skipped ('') to keep the log short. */
export function describeEvent(event: TurnEvent, state: MatchState): string {
  const n = (id: PlayerId) => name(state, id);
  switch (event.type) {
    case 'move':
      return '';
    case 'bounce':
      return `${n(event.playerId)} は味方と重なり ${pos(event.to)} に戻された`;
    case 'displace':
      return `${n(event.playerId)} は ${pos(event.from)}→${pos(event.to)} へ押し出された`;
    case 'duel': {
      const loser = event.winnerId === event.aId ? event.bId : event.aId;
      if (event.loose) return `こぼれ球の競り合い: ${n(event.winnerId)} が ${n(loser)} に競り勝ちボールを確保`;
      const kind = event.kind === 'aerial' ? '空中戦' : '競り合い';
      return `${kind}！ ${n(event.winnerId)} が ${n(loser)} に勝利${event.forBall ? '（ボール）' : ''}`;
    }
    case 'pickup':
      return `${n(event.playerId)} がボールを拾った`;
    case 'pass': {
      const kindName = event.style === 'lofted' ? '浮き玉パス' : 'ゴロパス';
      if (event.space) {
        const head = event.early
          ? `${n(event.passerId)} がスルーパス（${event.style === 'lofted' ? '浮き玉' : 'ゴロ'}）`
          : `${n(event.passerId)} がスペースへ${kindName}`;
        switch (event.outcome) {
          case 'intercepted':
            return event.interceptorId ? `${head} → ${n(event.interceptorId)} がカット！` : `${head} → カットされた`;
          case 'complete':
            return `${head} → ${event.receiverId ? n(event.receiverId) : '味方'} が受けた`;
          case 'toEnemy':
            return `${head} → ${event.receiverId ? n(event.receiverId) : '相手'} に渡ってしまった`;
          case 'loose':
            return `${head} → 誰も触れずルーズボール ${pos(event.loosePos ?? event.to)}`;
          default:
            return `${head} → 乱れた${event.loosePos ? ` ${pos(event.loosePos)} にこぼれ球` : ''}`;
        }
      }
      if (event.outcome === 'intercepted' && event.interceptorId)
        return `${n(event.interceptorId)} が${kindName}をカット！`;
      if (event.outcome === 'complete' && event.targetId)
        return `${n(event.passerId)} → ${n(event.targetId)} ${kindName}成功`;
      return `${n(event.passerId)} の${kindName}が乱れた${event.loosePos ? ` ${pos(event.loosePos)} にこぼれ球` : ''}`;
    }
    case 'cross': {
      const head = `${n(event.passerId)} → ${n(event.targetId)} クロス`;
      switch (event.outcome) {
        case 'failed':
          return `${head}は失敗${event.loosePos ? ` ${pos(event.loosePos)} にこぼれ球` : ''}`;
        case 'won':
          return `${head}、空中戦に勝った`;
        case 'lost':
          return `${head}、空中戦で${event.defenderId ? n(event.defenderId) : '守備側'}に競り負けた`;
        default:
          return `${head}が通った`;
      }
    }
    case 'offside':
      return `オフサイド！${event.early ? '（蹴った時点の位置で）' : ''} ${n(event.receiverId)} の飛び出しが早すぎた → ${n(event.toPlayerId)} のボール`;
    case 'shot': {
      const what = event.kind === 'header' ? 'ヘディングシュート' : 'シュート';
      if (event.outcome === 'blocked')
        return `${n(event.shooterId)} の${what}を ${event.blockerId ? n(event.blockerId) : '守備'} がブロック！`;
      if (event.outcome === 'missed') return `${n(event.shooterId)} の${what}は外れた`;
      return `${n(event.shooterId)} の${what}が決まる！`;
    }
    case 'actionCancelled': {
      const what = event.action === 'cross' ? 'クロス' : event.action === 'shoot' ? 'シュート' : 'パス';
      return event.reason === 'outOfRange'
        ? `${n(event.playerId)} の${what}は届かない距離のため中止`
        : `${n(event.playerId)} の${what}は対象が無効のため中止`;
    }
    case 'goal':
      return `GOAL! ${n(event.scorerId)}`;
    case 'goalKick':
      return `${TEAM_LABEL[event.team]} ゴールキック（${n(event.playerId)}）`;
    case 'kickoff':
      return `${TEAM_LABEL[event.team]} ボールでキックオフ`;
    case 'matchEnd': {
      const s = `${event.score.blue}-${event.score.red}`;
      return event.winner === 'draw' ? `試合終了 ${s} 引き分け` : `試合終了 ${s} ${TEAM_LABEL[event.winner]}の勝利`;
    }
  }
}
