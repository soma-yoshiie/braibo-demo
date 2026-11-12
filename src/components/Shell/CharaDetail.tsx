import { CharaBust, SpeedLines, Stars } from '../Chara';
import { ROLE_LABEL } from '../../game/data/characters';
import type { SaveData } from '../../meta/save';
import { MoveDiagram } from './MoveDiagram';
import { Sheet } from './Sheet';
import { StatBars } from './StatBars';
import { SKILL_LABEL, charaInfo } from './chara';
import './Shell.css';

interface Props {
  id: string;
  save: SaveData;
  onClose: () => void;
  onSet: (id: string) => void;
}

export function CharaDetail({ id, save, onClose, onSet }: Props) {
  const { profile, def, team } = charaInfo(id);
  const inLineup = save.lineup[profile.role] === id;
  const dup = Math.max(0, (save.owned[id] ?? 0) - 1);
  return (
    <Sheet onClose={onClose} testId="chara-detail" closeTestId="chara-detail-close" className="detail">
      <div className={`detail__head detail__head--r${profile.rarity}`}>
        <div className="detail__rays"><SpeedLines /></div>
        <div className="detail__bust"><CharaBust look={profile.look} team={team} /></div>
        <div className="detail__id">
          <span className="detail__title">{profile.title}</span>
          <span className="a-head a-head--lg detail__name">{def.name}</span>
          <Stars rarity={profile.rarity} size={16} />
          <span className="detail__tags">
            <span className="a-tag a-tag--dark">#{profile.number}</span>
            <span className="a-tag">{ROLE_LABEL[profile.role]}</span>
          </span>
        </div>
      </div>
      <div className="detail__skill">
        <span className="a-tag a-tag--dark">SKILL</span>
        <b>{def.skills.length ? def.skills.map((s) => SKILL_LABEL[s]).join(' / ') : 'なし'}</b>
      </div>
      <div className="detail__body">
        <StatBars stats={def.stats} role={profile.role} />
        <MoveDiagram moves={def.moves} />
      </div>
      <p className="detail__quote">「{profile.quotes.duel}」</p>
      <div className="detail__foot">
        <span className="detail__dup">重複して引いた回数 <b className="a-num">{dup}</b></span>
        {inLineup ? (
          <span className="a-tag a-tag--blue detail__now" data-testid="chara-detail-now">編成中</span>
        ) : (
          <button type="button" className="a-btn a-btn--yellow a-btn--sm detail__set" onClick={() => onSet(id)} data-testid="chara-detail-set">
            <span>このロールに編成する</span>
          </button>
        )}
      </div>
    </Sheet>
  );
}
