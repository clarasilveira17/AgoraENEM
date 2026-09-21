import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

/**
 * Exportação do Boletim Oficial para PDF.
 *
 * Por que este módulo existe:
 * o html2canvas rasteriza o nó que está VIVO na tela. Se esse nó estiver dentro
 * de um wrapper com `transform: scale()`, dentro de um container com scroll, ou
 * se as webfonts (Inter / Merriweather) ainda não estiverem resolvidas, o
 * bitmap gerado não corresponde ao que o usuário vê na prévia. Aqui o nó é
 * clonado para um host isolado (sem transform, sem scroll, no topo do
 * documento) e só então capturado.
 */

const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;

/**
 * Garante que as fontes do documento terminaram de carregar antes da
 * rasterização. Sem isso o html2canvas cai no fallback (Arial/Helvetica),
 * as métricas de texto mudam e os elementos com caixa justa — como os selos
 * de nível da seção 2 — saem do lugar.
 */
const waitForFonts = async () => {
  try {
    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready;
    }
  } catch {
    // Navegador sem FontFaceSet: segue o fluxo normalmente.
  }
  // Dois frames para o layout assentar depois do carregamento das fontes.
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
};

/**
 * Clona o nó para um host limpo e captura. O clone herda os estilos inline do
 * componente (que é todo inline-style), mas fica livre de qualquer transform,
 * offset de scroll ou clipping herdado da prévia.
 */
const captureNode = async (node, scale) => {
  const host = document.createElement('div');
  host.setAttribute('data-pdf-capture-host', 'true');
  host.style.cssText = [
    'position:fixed',
    'top:0',
    'left:-100000px',
    'margin:0',
    'padding:0',
    'border:0',
    'background:#ffffff',
    'transform:none',
    'filter:none',
    'opacity:1',
    'overflow:visible',
    'pointer-events:none',
    'z-index:-2147483640'
  ].join(';');

  const clone = node.cloneNode(true);

  // IDs duplicados no documento confundem o html2canvas na hora de clonar.
  clone.removeAttribute('id');
  clone.querySelectorAll('[id]').forEach((el) => el.removeAttribute('id'));

  // A página pode estar com display:none (caso da página 2 no modo 1 página).
  clone.style.display = 'block';
  clone.style.transform = 'none';
  clone.style.boxShadow = 'none';
  clone.style.margin = '0';

  host.appendChild(clone);
  document.body.appendChild(host);

  try {
    const width = Math.max(1, Math.ceil(clone.offsetWidth));
    const height = Math.max(1, Math.ceil(clone.offsetHeight));

    return await html2canvas(clone, {
      scale,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      width,
      height,
      windowWidth: width,
      windowHeight: height,
      scrollX: 0,
      scrollY: 0,
      imageTimeout: 15000,
      removeContainer: true
    });
  } finally {
    if (host.parentNode) host.parentNode.removeChild(host);
  }
};

/**
 * Insere o canvas na página preservando a proporção original.
 *
 * O código anterior fazia `addImage(img, 'PNG', 0, 0, 210, 297)`, forçando
 * qualquer proporção dentro do A4. Como a folha usa `min-height: 1080px`
 * (e não altura fixa), uma redação longa deixa a página mais alta que a
 * proporção A4 — e a imagem era então esmagada verticalmente. É isso que
 * fazia o PDF baixado divergir da prévia.
 */
const addCanvasAsPage = (pdf, canvas) => {
  const imgData = canvas.toDataURL('image/png');
  const ratio = canvas.height / canvas.width;

  let renderWidth = A4_WIDTH_MM;
  let renderHeight = renderWidth * ratio;
  let offsetX = 0;
  const offsetY = 0;

  // Mais alto que a folha: reduz pela altura em vez de distorcer.
  if (renderHeight > A4_HEIGHT_MM) {
    renderHeight = A4_HEIGHT_MM;
    renderWidth = renderHeight / ratio;
    offsetX = (A4_WIDTH_MM - renderWidth) / 2;
  }

  pdf.addImage(imgData, 'PNG', offsetX, offsetY, renderWidth, renderHeight, undefined, 'FAST');
};

/**
 * Monta o objeto jsPDF a partir dos nós já renderizados (compartilhado entre
 * "baixar" e "imprimir" — a captura é idêntica, só muda o destino final).
 */
const buildFolhaOficialPdf = async ({ page1El, page2El, includePage2, scale }) => {
  if (!page1El) {
    throw new Error('Documento ainda não renderizado para exportação.');
  }

  await waitForFonts();

  const canvas1 = await captureNode(page1El, scale);

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true
  });

  addCanvasAsPage(pdf, canvas1);

  if (includePage2 && page2El) {
    const canvas2 = await captureNode(page2El, scale);
    pdf.addPage('a4', 'portrait');
    addCanvasAsPage(pdf, canvas2);
  }

  return pdf;
};

/**
 * Gera e salva o boletim em PDF.
 *
 * @param {Object}  options
 * @param {Element} options.page1El   Nó da página 1 (obrigatório)
 * @param {Element} [options.page2El] Nó da página 2
 * @param {boolean} [options.includePage2]
 * @param {string}  options.filename
 * @param {number}  [options.scale]   Fator de rasterização (padrão 3)
 */
export const exportFolhaOficialPdf = async ({
  page1El,
  page2El = null,
  includePage2 = false,
  filename = 'Boletim_Redacao.pdf',
  scale = 3
}) => {
  const pdf = await buildFolhaOficialPdf({ page1El, page2El, includePage2, scale });
  pdf.save(filename);
};

/**
 * "Imprimir" o boletim.
 *
 * Por que isso existe em vez de `window.print()`:
 * a impressão nativa do navegador depende de CSS (`@media print`) escondendo
 * o resto da página de uma SPA e reposicionando o documento por cima. Isso se
 * mostrou frágil nesse projeto — o restante do app fica com `visibility:
 * hidden` mas continua ocupando espaço no fluxo da página, o que confunde a
 * paginação do navegador na hora de imprimir (espaço em branco antes do
 * conteúdo, conteúdo repetido/cortado entre páginas).
 *
 * A abordagem aqui evita esse problema inteiro: gera o mesmo PDF confiável do
 * botão "Baixar" e abre esse PDF (arquivo real, sem nenhuma outra coisa do
 * app junto) numa aba nova. O visualizador de PDF do navegador assume a
 * partir daí — ele tem seu próprio botão de impressão, e nós ainda tentamos
 * disparar o diálogo de impressão automaticamente assim que o PDF carrega.
 */
export const printFolhaOficialPdf = async ({
  page1El,
  page2El = null,
  includePage2 = false,
  scale = 3
}) => {
  const pdf = await buildFolhaOficialPdf({ page1El, page2El, includePage2, scale });
  const blobUrl = pdf.output('bloburl');

  const printWindow = window.open(blobUrl, '_blank');

  if (!printWindow) {
    // Pop-up bloqueado pelo navegador: melhor abrir numa aba normal do que
    // falhar silenciosamente.
    window.open(blobUrl, '_blank', 'noopener');
    return;
  }

  // Tenta disparar o diálogo de impressão nativo assim que o PDF carregar.
  // Alguns navegadores bloqueiam .print() em janelas de outra origem (blob:
  // costuma ser tratado como same-origin, mas nem sempre); se falhar, o
  // visualizador de PDF nativo já tem seu próprio botão de impressão.
  const tryAutoPrint = () => {
    try {
      printWindow.focus();
      printWindow.print();
    } catch {
      // Sem problema — o botão de impressão do próprio visualizador de PDF resolve.
    }
  };

  printWindow.addEventListener('load', tryAutoPrint);
  // Fallback: alguns navegadores não disparam 'load' de forma confiável para blob PDFs.
  setTimeout(tryAutoPrint, 800);
};

export default exportFolhaOficialPdf;
