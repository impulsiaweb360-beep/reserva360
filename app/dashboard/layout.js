// Panel privado: nunca se indexa
export const metadata = {
  title: { absolute: 'Panel | Reserva360' },
  robots: { index: false, follow: false, nocache: true },
};

export default function DashboardLayout({ children }) {
  return children;
}
