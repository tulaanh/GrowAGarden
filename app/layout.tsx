import type { Metadata, Viewport } from 'next';
import { Nunito } from 'next/font/google';
import {ViewportLock} from './viewport-lock';
import './globals.css';
const nunito=Nunito({subsets:['latin','vietnamese'],display:'swap'});

export const metadata: Metadata = { title: 'Vườn Bài Tập', description: 'Một khu vườn nhỏ cho những bước học mỗi ngày.' };
export const viewport: Viewport = { width:'device-width',initialScale:1,minimumScale:1,maximumScale:1,userScalable:false };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="vi"><body className={nunito.className}><ViewportLock/>{children}</body></html>;
}
