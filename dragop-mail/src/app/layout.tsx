import type { Metadata } from "next";
import { DM_Sans, Noto_Sans_JP } from "next/font/google";
import { ThemeProvider } from "@/components/ThemeProvider";
import { GoogleAuthWrapper } from "@/components/GoogleAuthWrapper";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
});

const notoSansJP = Noto_Sans_JP({
  subsets: ["latin"],
  variable: "--font-noto-sans-jp",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Dragop Mail",
  description: "Drop your email, get insights.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <body
        className={`${dmSans.variable} ${notoSansJP.variable} font-sans antialiased bg-surface text-text-primary transition-colors duration-300`}
      >
        {/* Theme init (prevent flash) */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var t=localStorage.getItem("theme");var d=t==="dark"||(!t&&window.matchMedia("(prefers-color-scheme:dark)").matches);if(d)document.documentElement.classList.add("dark");})();`,
          }}
        />
        {/* Drag & drop handler — only fires when dropped on [data-dragop-zone] */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              document.addEventListener("dragover", function(e) {
                e.preventDefault();
                if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
              }, true);
              document.addEventListener("drop", function(e) {
                e.preventDefault();
                var target = e.target;
                var zone = target && target.closest ? target.closest("[data-dragop-zone]") : null;
                var dropZone = target && target.closest ? target.closest("[data-drop-zone]") : null;
                if (!zone && !dropZone) return;
                var dt = e.dataTransfer;
                if (!dt) return;
                var detail = {
                  types: Array.from(dt.types),
                  files: [],
                  data: {},
                  dropX: e.clientX,
                  dropY: e.clientY,
                  dropZoneId: dropZone ? dropZone.getAttribute("data-drop-zone") : null
                };
                for (var i = 0; i < dt.files.length; i++) {
                  detail.files.push(dt.files[i]);
                }
                dt.types.forEach(function(t) {
                  try { detail.data[t] = dt.getData(t); } catch(e) {}
                });
                window.dispatchEvent(new CustomEvent("dragop-drop", { detail: detail }));
              }, true);
            `,
          }}
        />
        <GoogleAuthWrapper>
          <ThemeProvider>{children}</ThemeProvider>
        </GoogleAuthWrapper>
      </body>
    </html>
  );
}
