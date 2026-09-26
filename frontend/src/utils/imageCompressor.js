/**
 * Utilitário de Compressão e Otimização de Imagens no Navegador
 * 
 * Reduz fotos pesadas de celulares (5MB-15MB) para imagens JPEG otimizadas (~200KB-400KB)
 * preservando resolução nítida (1800px) ideal para OCR e visão computacional do Gemini.
 */
export async function compressImageFile(file, maxWidth = 1800, quality = 0.85) {
  if (!file) return null;

  // Se já for uma string base64 ou texto puro, retorna diretamente
  if (typeof file === 'string') {
    return {
      base64: file,
      sizeKB: (file.length / 1024).toFixed(1)
    };
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = (err) => reject(err);
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = (err) => reject(err);
      img.onload = () => {
        let { width, height } = img;

        // Se a imagem for maior que a largura máxima, redimensiona mantendo proporção
        if (width > maxWidth || height > maxWidth) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxWidth) / height);
            height = maxWidth;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        // Preenchimento branco para evitar transparências escuras em PNGs convertidos
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
        const sizeKB = (compressedBase64.length * 0.75 / 1024).toFixed(1);

        resolve({
          base64: compressedBase64,
          sizeKB: `${sizeKB} KB`,
          width,
          height
        });
      };

      img.src = e.target.result;
    };

    reader.readAsDataURL(file);
  });
}
