import type { Metadata } from 'next'
import './globals.css'
import { WalletProvider } from '@/components/WalletProvider'

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
    <html lang="en" className="dark" suppressHydrationWarning>
      <body suppressHydrationWarning style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
        <WalletProvider>
          {children}
        </WalletProvider>
      </body>
    </html>
  )
}
