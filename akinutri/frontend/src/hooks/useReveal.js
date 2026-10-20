import { useEffect } from 'react';
// One observer per page; sections reveal once and stop being observed.
export default function useReveal(ref) {
  useEffect(() => {
    if (
      !ref.current ||
      typeof IntersectionObserver === 'undefined' ||
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    )
      return;
    const nodes = [...ref.current.querySelectorAll('.reveal-item')];
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.dataset.reveal = 'visible';
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.08 },
    );
    nodes.forEach((node) => {
      node.dataset.reveal = 'pending';
      observer.observe(node);
    });
    return () => {
      observer.disconnect();
      nodes.forEach((node) => delete node.dataset.reveal);
    };
  }, [ref]);
}
