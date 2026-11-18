// Gestión privada de una cita (enlace personal del cliente): nunca se indexa
export const metadata = {
  title: { absolute: 'Gestionar mi cita | Reserva360' },
  robots: { index: false, follow: false, nocache: true },
};

export default function ManageLayout({ children }) {
  return children;
}
