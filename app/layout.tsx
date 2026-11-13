import type { Metadata } from 'next';
import { Nunito } from 'next/font/google';
import './globals.css';
const nunito=Nunito({subsets:['latin','vietnamese'],display:'swap'});

export const metadata: Metadata = { title: 'Vườn Bài Tập', description: 'Một khu vườn nhỏ cho những bước học mỗi ngày.' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="vi"><body className={nunito.className}>{children}</body></html>;
}
