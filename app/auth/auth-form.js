'use client';

import { useState, useTransition } from 'react';

export default function AuthForm({ action, children, className }) {
  const [error, setError] = useState(null);
  const [pending, startTransition] = useTransition();

  const onSubmit = (e) => {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await action(formData);
      if (result?.error) setError(result.error);
      else if (result?.success) setError('SUCCESS');
    });
  };

  return (
    <form onSubmit={onSubmit} className={className}>
      {error && error !== 'SUCCESS' && (
        <div className="rounded-md bg-rose-50 border border-rose-200 px-3 py-2 text-sm text-rose-700">{error}</div>
      )}
      {error === 'SUCCESS' && (
        <div className="rounded-md bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm text-emerald-700">¡Listo! Revisa tu email.</div>
      )}
      <fieldset disabled={pending} className="space-y-4 disabled:opacity-60">
        {children}
      </fieldset>
    </form>
  );
}
