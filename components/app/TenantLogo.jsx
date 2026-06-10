'use client';

/**
 * Renders a tenant logo: shows an <img> when value looks like a URL,
 * otherwise shows the emoji/text fallback.
 *
 * Props:
 *  - logo: string (URL or emoji)
 *  - name: string (alt)
 *  - size: tailwind size class for the wrapper (e.g. "h-8 w-8")
 *  - textSize: tailwind text size class for emoji fallback (e.g. "text-xl")
 *  - rounded: tailwind rounded class (default "rounded-lg")
 *  - bordered: boolean to add border + bg
 */
export default function TenantLogo({
  logo,
  name = 'Logo',
  size = 'h-10 w-10',
  textSize = 'text-xl',
  rounded = 'rounded-lg',
  bordered = false,
  padding = 'p-0.5',
}) {
  const isUrl = !!logo && /^https?:\/\//.test(logo);
  const wrapperClasses = `inline-flex shrink-0 items-center justify-center overflow-hidden ${size} ${rounded} ${
    bordered ? 'border border-slate-200 bg-white' : ''
  }`;

  if (isUrl) {
    return (
      <span className={wrapperClasses}>
        <img src={logo} alt={name} className={`h-full w-full object-contain ${padding}`} />
      </span>
    );
  }

  return (
    <span className={`${wrapperClasses} ${textSize}`}>
      {logo || '✨'}
    </span>
  );
}
