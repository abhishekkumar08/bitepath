import { describeFailure } from '@/scene/beats/player';
import type { BeatFailure } from '@/scene/beats/types';

const BADGE_ID = 'beat-dev-error';
const BADGE_STYLE =
  'position:fixed;bottom:8px;right:8px;z-index:99;max-width:min(420px,calc(100vw - 16px));padding:8px 12px;border-radius:8px;background:#b3122e;color:#fff;font:600 12px/1.4 system-ui,sans-serif;pointer-events:none';

export function showBeatError(failure: BeatFailure): void {
  let badge = document.getElementById(BADGE_ID);
  if (!badge) {
    badge = document.createElement('div');
    badge.id = BADGE_ID;
    badge.setAttribute('style', BADGE_STYLE);
    document.body.append(badge);
  }
  const line = document.createElement('div');
  line.textContent = `Beat failed: ${describeFailure(failure)}`;
  badge.append(line);
}
