'use client';

import { useEffect } from 'react';
import { track, trackOnce } from '@/lib/analytics';

// Dispara un evento al montar el componente (p. ej. registro completado)
export default function TrackEvent({ event, params, onceKey }) {
  useEffect(() => {
    if (onceKey) trackOnce(onceKey, event, params);
    else track(event, params);
    // eslint-disable-next-line
  }, []);
  return null;
}
