import React from 'react';
import './globals.css';

export const metadata = {
  title: 'ActionOS · Alexa+ for OneWayFix',
  description: 'Voice-first Alexa+ assistant for OneWayFix home-service bookings powered by MCP',
};


export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-slate-950 text-slate-100 antialiased font-sans">
        {children}
      </body>
    </html>
  );
}
