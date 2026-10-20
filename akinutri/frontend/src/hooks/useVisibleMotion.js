import { useEffect, useRef } from 'react';
// DOM-only animation state avoids rendering React on scroll. Every observer/listener is released.
export default function useVisibleMotion() {
  const ref = useRef(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    let visible = true;
    const update = () => {
      node.dataset.motion = visible && !document.hidden ? 'visible' : 'hidden';
    };
    const observer =
      typeof IntersectionObserver !== 'undefined'
        ? new IntersectionObserver(
            ([entry]) => {
              visible = entry.isIntersecting;
              update();
            },
            { threshold: 0.01 },
          )
        : null;
    observer?.observe(node);
    document.addEventListener('visibilitychange', update);
    update();
    return () => {
      observer?.disconnect();
      document.removeEventListener('visibilitychange', update);
    };
  }, []);
  return ref;
}
