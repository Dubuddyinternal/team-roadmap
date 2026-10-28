import { SPRITE } from './sprite-markup';

/* Every icon on the site is a <use href="#d-..."> into this sprite. */
export default function Sprite() {
  return (
    <div
      aria-hidden="true"
      style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}
      dangerouslySetInnerHTML={{ __html: SPRITE }}
    />
  );
}
