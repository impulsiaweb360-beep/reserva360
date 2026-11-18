// Las páginas de acceso no se indexan (salvo el registro, que lo indica en su propia página)
export const metadata = {
  title: { absolute: 'Acceso a tu cuenta | Reserva360' },
  robots: { index: false, follow: true },
};

export default function AuthLayout({ children }) {
  return children;
}
