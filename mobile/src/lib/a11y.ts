import { useEffect, useState, type RefObject } from 'react';
import { AccessibilityInfo, type ViewInstance } from 'react-native';

/** Speak a status change through TalkBack (no-op when TalkBack is off). */
export function announce(message: string): void {
  AccessibilityInfo.announceForAccessibility(message);
}

/** Move TalkBack focus to an element, e.g. a screen heading or a result. */
export function focusElement(ref: RefObject<ViewInstance | null>, delayMs = 350): void {
  setTimeout(() => {
    if (ref.current) AccessibilityInfo.sendAccessibilityEvent(ref.current, 'focus');
  }, delayMs);
}

export function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => alive && setReduce(v));
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  return reduce;
}

export function useScreenReader(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isScreenReaderEnabled().then((v) => alive && setOn(v));
    const sub = AccessibilityInfo.addEventListener('screenReaderChanged', setOn);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  return on;
}
