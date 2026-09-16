import './globals.css';

export const metadata = {
  title: 'Shellui Next companion',
  description: 'Next.js companion app for Shellui with theme and i18n sync',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
