import { useState } from 'react';
import { gachaRates } from '../../meta/gacha';
import { META } from '../../meta/config';
import { getProfile } from '../../game/data/roster';
import { Stars } from '../Chara';
import type { SaveSettings } from '../../meta/save';
import { Sheet } from './Sheet';
import './Shell.css';

export function HowToSheet({ onClose }: { onClose: () => void }) {
  return (
    <Sheet title="遊び方" onClose={onClose} testId="howto-sheet" closeTestId="howto-close">
      <ol className="howto">
        <li><i className="a-num">1</i><span>青の選手をタップして移動先を指定</span></li>
        <li><i className="a-num">2</i><span>ボール保持者はシュート・パス・クロスを選ぶ</span></li>
        <li><i className="a-num">3</i><span>「実行！」で敵と同時に動き出す！</span></li>
      </ol>
      <p className="howto__note">敵と同じマスにも並べる。競り合いはボールがあるマスだけ、負けてもその場に残る。</p>
      <p className="howto__note">スルーパス（空きマスへのパス）は動く前に蹴る。オフサイドは今の位置で決まる。</p>
    </Sheet>
  );
}

function Toggle({ label, value, onChange, testId }: { label: string; value: boolean; onChange: (v: boolean) => void; testId: string }) {
  return (
    <label className="stoggle">
      <span>{label}</span>
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} data-testid={testId} />
      <i className="stoggle__track" />
    </label>
  );
}

interface SettingsProps {
  settings: SaveSettings;
  onPatch: (p: Partial<SaveSettings>) => void;
  onReset: () => void;
  onClose: () => void;
}

export function SettingsSheet({ settings, onPatch, onReset, onClose }: SettingsProps) {
  const [ask, setAsk] = useState(false);
  return (
    <Sheet title="設定" onClose={onClose} testId="settings-sheet" closeTestId="settings-close">
      <Toggle label="作戦タイマー" value={settings.timerOn} onChange={(v) => onPatch({ timerOn: v })} testId="settings-timer" />
      <Toggle label="先出しスルーパス" value={settings.throughEarly} onChange={(v) => onPatch({ throughEarly: v })} testId="settings-through" />
      <Toggle label="カットイン演出" value={settings.cutIn} onChange={(v) => onPatch({ cutIn: v })} testId="settings-cutin" />
      <div className="sheet__danger">
        {!ask ? (
          <button type="button" className="a-btn a-btn--red a-btn--block" onClick={() => setAsk(true)} data-testid="settings-reset">
            <span>データを初期化</span>
          </button>
        ) : (
          <>
            <p className="howto__note">コインと所持選手、戦績がすべて最初に戻ります。よろしいですか？</p>
            <div className="sheet__row">
              <button type="button" className="a-btn a-btn--dark" onClick={() => setAsk(false)}><span>やめる</span></button>
              <button
                type="button"
                className="a-btn a-btn--red"
                onClick={() => {
                  onReset();
                  setAsk(false);
                  onClose();
                }}
                data-testid="settings-reset-ok"
              >
                <span>初期化する</span>
              </button>
            </div>
          </>
        )}
      </div>
    </Sheet>
  );
}

const pct = (v: number, d = 2): string => `${(v * 100).toFixed(d)}%`;

export function RatesSheet({ onClose, startTab = 'normal' }: { onClose: () => void; startTab?: 'normal' | 'guaranteed' }) {
  const [tab, setTab] = useState<'normal' | 'guaranteed'>(startTab);
  const slots = gachaRates();
  const slot = slots.find((s) => s.slot === tab) ?? slots[0];
  return (
    <Sheet title="提供割合" onClose={onClose} testId="rates-sheet" closeTestId="rates-close" className="rates">
      <div className="rates__tabs">
        <button type="button" className={tab === 'normal' ? 'is-on' : ''} onClick={() => setTab('normal')}>通常枠</button>
        <button type="button" className={tab === 'guaranteed' ? 'is-on' : ''} onClick={() => setTab('guaranteed')}>確定枠（10連の10人目）</button>
      </div>
      {slot.rows.map((row) => (
        <section key={row.rarity} className="rates__sec">
          <div className="rates__head">
            <Stars rarity={row.rarity} size={14} />
            <b className="a-num">{pct(row.rate)}</b>
          </div>
          <ul>
            {row.ids.map((id) => (
              <li key={id}>
                <span>{getProfile(id).name}</span>
                <b className="a-num">{pct(row.each)}</b>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <p className="howto__note">
        すでに持っている選手が出ると、コインが戻ります（★3 {META.gacha.dupRefund[3]} / ★4 {META.gacha.dupRefund[4]} / ★5 {META.gacha.dupRefund[5]}）。
        10連の10人目は★{META.gacha.guaranteedMin10}以上が確定します。
      </p>
    </Sheet>
  );
}
