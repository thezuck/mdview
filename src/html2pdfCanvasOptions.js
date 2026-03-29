/** Options passed to html2canvas via html2pdf.js (public API). */
export function getHtml2PdfCanvasOptions() {
  return {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
    onclone(clonedDoc) {
      clonedDoc.querySelectorAll('.html2pdf__overlay').forEach((el) => {
        el.style.opacity = '1';
        el.style.pointerEvents = 'none';
      });
    },
  };
}
