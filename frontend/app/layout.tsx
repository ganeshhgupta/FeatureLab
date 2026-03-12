import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'FeatureLab | Autonomous ML Feature Engineering',
  description: 'AI-powered autonomous feature engineering agent for CTR prediction',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
