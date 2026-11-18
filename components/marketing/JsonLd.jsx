// Datos estructurados (schema.org). Solo información real y verificable.
import { SITE_URL, SITE_NAME, SITE_EMAIL, absoluteUrl } from '@/lib/site';

export default function JsonLd({ data }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />;
}

export const organizationLd = () => ({
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: SITE_NAME,
  url: SITE_URL,
  logo: absoluteUrl('/brand/logo-reserva360-96.png'),
  email: SITE_EMAIL,
});

export const websiteLd = () => ({
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: SITE_NAME,
  url: SITE_URL,
  inLanguage: 'es-ES',
});

export const softwareLd = (plans) => ({
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: SITE_NAME,
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  url: SITE_URL,
  description: 'Software de gestión de citas y reservas online para negocios: agenda, clientes, empleados, horarios y recordatorios automáticos.',
  offers: plans.map((p) => ({
    '@type': 'Offer',
    name: `Plan ${p.name}`,
    price: String(p.monthly || 0),
    priceCurrency: 'EUR',
  })),
});

export const breadcrumbLd = (items) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: absoluteUrl(it.path) })),
});

export const faqLd = (faqs) => ({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
});
