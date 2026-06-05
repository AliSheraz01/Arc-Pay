import type { Metadata } from 'next'
import './globals.css'
import { WalletProvider } from '@/components/WalletProvider'
import { Outfit } from 'next/font/google'

const outfit = Outfit({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800', '900'],
  variable: '--font-outfit',
})

export const metadata: Metadata = {
  title: 'ArcPay — Instant USDC Payments on Arc Network',
  description: 'Send and receive USDC instantly on Arc Network. The fastest, cheapest peer-to-peer stablecoin payment app.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${outfit.variable}`} suppressHydrationWarning>
      <body suppressHydrationWarning style={{ fontFamily: 'var(--font-outfit), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
        <WalletProvider>
          {children}
        </WalletProvider>
      </body>
    </html>
  )
}

