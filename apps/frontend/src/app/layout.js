import { Geist, Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const delthaFont = localFont({
  src: "../../public/fonts/Deltha.otf",
  variable: "--font-deltha",
});

export const metadata = {
  title: "Orbit - Real-Time Event Tracking & Location Sharing",
  description: "Create temporary event rooms, share a live link with friends, and see everyone live on a map. Private coordination that automatically expires after your event.",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${delthaFont.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
