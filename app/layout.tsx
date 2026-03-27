import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "THE GARDEN X",
  description: "Client portal – 3L J4RD1N",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="dark">
      <body className="bg-bg text-white antialiased grid-bg min-h-screen">
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html: `
(function(){
  // Disable right-click
  document.addEventListener('contextmenu',function(e){e.preventDefault();});

  // Block keyboard shortcuts for DevTools / View Source
  document.addEventListener('keydown',function(e){
    if(e.key==='F12'){e.preventDefault();return false;}
    if(e.ctrlKey&&e.shiftKey&&['I','J','C','i','j','c'].includes(e.key)){e.preventDefault();return false;}
    if(e.ctrlKey&&(e.key==='u'||e.key==='U')){e.preventDefault();return false;}
    if(e.ctrlKey&&(e.key==='s'||e.key==='S')){e.preventDefault();return false;}
  });

  // Disable text selection and drag (except inputs)
  document.addEventListener('selectstart',function(e){
    if(e.target&&(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA'))return;
    e.preventDefault();
  });
  document.addEventListener('dragstart',function(e){e.preventDefault();});
})();
`,
          }}
        />
      </body>
    </html>
  );
}
