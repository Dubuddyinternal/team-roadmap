import { CFG, money } from '@/lib/config';

/* Base pay row plus one row per bonus slab. `active` is the slab index to
   highlight (-1 for none). `onPick` makes rows clickable. */
export default function Ladder({ active = -1, onPick }) {
  return (
    <div className="ladder">
      <div className="rung base small">
        <span className="dotm" />
        <span className="vw">Base pay</span>
        <span className="note">every approved and published video, no view target</span>
        <span className="amt">{money(CFG.base)}</span>
      </div>
      {CFG.slabs.map((s, k) => (
        <div
          key={s.min}
          className={`rung small${k === active ? ' on' : ''}`}
          onClick={onPick ? () => onPick(s.min) : undefined}
        >
          <span className="dotm" />
          <span className="vw">{s.label} views</span>
          {onPick && <span className="try">try it</span>}
          <span className="amt">+{money(s.bonus)}</span>
        </div>
      ))}
    </div>
  );
}
