import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ToolLighthouse | Estación de devolución',
  description: 'Identificación visual y guía de almacenamiento para herramientas de KEY Week.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body>{children}</body></html>;
}
