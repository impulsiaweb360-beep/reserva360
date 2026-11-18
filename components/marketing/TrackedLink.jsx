'use client';

import Link from 'next/link';
import { track } from '@/lib/analytics';

// Enlace que registra el clic (sin datos personales) antes de navegar
export default function TrackedLink({ href, event = 'cta_signup_click', location, label, children, ...props }) {
  return (
    <Link
      href={href}
      onClick={() => track(event, { cta_location: location, cta_label: label, page_path: typeof window !== 'undefined' ? window.location.pathname : undefined })}
      {...props}
    >
      {children}
    </Link>
  );
}
