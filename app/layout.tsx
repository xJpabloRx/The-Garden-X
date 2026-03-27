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
    // F12
    if(e.key==='F12'){e.preventDefault();return false;}
    // Ctrl+Shift+I / Ctrl+Shift+J / Ctrl+Shift+C
    if(e.ctrlKey&&e.shiftKey&&['I','J','C','i','j','c'].includes(e.key)){e.preventDefault();return false;}
    // Ctrl+U (view source)
    if(e.ctrlKey&&(e.key==='u'||e.key==='U')){e.preventDefault();return false;}
    // Ctrl+S (save page)
    if(e.ctrlKey&&(e.key==='s'||e.key==='S')){e.preventDefault();return false;}
  });

  // Disable text selection and drag
  document.addEventListener('selectstart',function(e){
    if(e.target&&(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA'))return;
    e.preventDefault();
  });
  document.addEventListener('dragstart',function(e){e.preventDefault();});

  // DevTools detection — redirect or clear page
  var threshold=160;
  function checkDevTools(){
    var w=window.outerWidth-window.innerWidth>threshold;
    var h=window.outerHeight-window.innerHeight>threshold;
    if(w||h){document.body.innerHTML='<div style="display:flex;align-items:center;justify-content:center;height:100vh;background:#0a0a1a;color:#ef4444;font-family:monospace;font-size:1.2rem;text-align:center;padding:2rem;">Access denied.<br>Developer tools are not allowed.</div>';}
  }
  setInterval(checkDevTools,1000);
})();
`,
          }}
        />
      </body>
    </html>
  );
}
