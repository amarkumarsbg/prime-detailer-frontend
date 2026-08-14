import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/shared/theme-provider";
import { BrandThemeApplier } from "@/components/shared/brand-theme-applier";
import { AttendanceRealtimeSync } from "@/components/attendance/attendance-realtime-sync";
import { VisualViewportCssVars } from "@/components/shared/visual-viewport-css-vars";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Prime Detailers - Car Service Management",
  description: "Admin CRM portal for car service business management",
};

/** Resize layout with the keyboard so fixed sheets/`dvh` stay above it on supporting browsers. */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
(function(){
  try {
    var k='theme';
    var t=localStorage.getItem(k);
    var d=document.documentElement;
    if(t==='dark') d.classList.add('dark');
    else if(t==='light') d.classList.remove('dark');
    else if(!t||t==='system'){
      if(window.matchMedia('(prefers-color-scheme: dark)').matches) d.classList.add('dark');
      else d.classList.remove('dark');
    }
  }catch(e){}
})();`,
          }}
        />
      </head>
      <body className={`${inter.variable} font-sans antialiased`}>
        <ThemeProvider>
          <BrandThemeApplier />
          <VisualViewportCssVars />
          <AttendanceRealtimeSync />
          {children}
          <Toaster position="top-right" richColors closeButton />
        </ThemeProvider>
      </body>
    </html>
  );
}
