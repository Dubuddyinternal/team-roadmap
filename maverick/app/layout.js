import { Outfit, Kalam } from 'next/font/google';
import Sprite from '@/components/Sprite';
import './prototype.css';
import './globals.css';

const outfit = Outfit({ subsets: ['latin'], weight: ['400', '500', '600', '700', '800'], variable: '--font-outfit' });
const kalam = Kalam({ subsets: ['latin'], weight: ['400', '700'], variable: '--font-kalam' });

export const metadata = {
  title: 'Maverick by Dubuddy',
  description: 'Get paid for the videos you already make. One video, one link, straight to your UPI.',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${outfit.variable} ${kalam.variable}`}>
      <body>
        <Sprite />
        {children}
      </body>
    </html>
  );
}
