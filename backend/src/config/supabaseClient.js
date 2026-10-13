import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(process.cwd(), 'backend/.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY 
  || process.env.SUPABASE_SECRET_KEY 
  || (process.env.SUPABASE_KEY && !process.env.SUPABASE_KEY.startsWith('sb_publishable_') ? process.env.SUPABASE_KEY : null)
  || process.env.SUPABASE_ANON_KEY 
  || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = !!(SUPABASE_URL && SUPABASE_KEY);

if (!isSupabaseConfigured && (process.env.NODE_ENV === 'production' || process.env.VERCEL)) {
  throw new Error('[Supabase Crítico] SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórias em ambiente de produção/Vercel.');
}

export const supabase = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false }
    })
  : null;

if (isSupabaseConfigured) {
  console.log('[Supabase Client] Configurado para:', SUPABASE_URL);

  // Diagnóstico assíncrono não-bloqueante de conectividade DNS/Rede
  supabase.from('users').select('id').limit(1).then(({ error }) => {
    if (error) {
      if (error.message?.includes('fetch failed') || String(error.details || '').includes('ENOTFOUND')) {
        console.error(`\n❌ [Supabase Conexão Falhou] O domínio "${SUPABASE_URL}" não existe ou não foi resolvido no DNS (ENOTFOUND).`);
        console.error('👉 CAUSAS MAIS PROVÁVEIS:');
        console.error('   1. O projeto no Supabase está PAUSADO por inatividade (plano gratuito). Acesse https://supabase.com/dashboard e clique em "Restore Project".');
        console.error('   2. A URL ou as chaves no arquivo backend/.env pertencem a um projeto desativado ou recriado.\n');
      } else {
        console.warn('[Supabase Conexão Aviso]:', error.message);
      }
    } else {
      console.log('✅ [Supabase Conexão] Banco de dados Postgres conectado e respondendo perfeitamente.');
    }
  }).catch((err) => {
    console.warn('[Supabase Conexão Aviso]:', err.message);
  });
} else {
  console.warn('[Supabase Client Alerta] Variáveis SUPABASE_URL/SUPABASE_KEY não detectadas.');
}

/**
 * Upload de imagem para o Supabase Storage (Bucket: redacoes-fotos)
 * Converte base64 para Buffer se necessário e envia para o bucket.
 */
export async function uploadEssayImageToStorage(base64Data, filename = null) {
  if (!supabase || !base64Data) return null;

  try {
    let cleanBase64 = base64Data;
    let mimeType = 'image/jpeg';

    if (base64Data.startsWith('data:')) {
      const match = base64Data.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        mimeType = match[1];
        cleanBase64 = match[2];
      }
    }

    const buffer = Buffer.from(cleanBase64, 'base64');
    const ext = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg';
    const uniquePath = `essays/${Date.now()}_${Math.random().toString(36).substring(2, 9)}_${filename || 'folha'}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('redacoes-fotos')
      .upload(uniquePath, buffer, {
        contentType: mimeType,
        upsert: true
      });

    if (uploadError) {
      console.warn('[Supabase Storage Warning]: Falha no upload:', uploadError.message);
      return null;
    }

    // Tenta gerar Signed URL para leitura protegida (válida por 24 horas)
    const { data: signedData, error: signError } = await supabase.storage
      .from('redacoes-fotos')
      .createSignedUrl(uniquePath, 60 * 60 * 24);

    if (!signError && signedData?.signedUrl) {
      return signedData.signedUrl;
    }

    // Fallback para URL pública caso o bucket seja público
    const { data: publicData } = supabase.storage
      .from('redacoes-fotos')
      .getPublicUrl(uniquePath);

    return publicData?.publicUrl || null;
  } catch (err) {
    console.error('[Supabase Storage Error]: Erro ao gravar imagem no Storage:', err.message);
    return null;
  }
}

/**
 * Upload de foto de perfil (avatar) para o Supabase Storage
 */
export async function uploadAvatarImageToStorage(base64Data, userId) {
  if (!supabase || !base64Data) return null;

  try {
    let cleanBase64 = base64Data;
    let mimeType = 'image/jpeg';

    if (base64Data.startsWith('data:')) {
      const match = base64Data.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        mimeType = match[1];
        cleanBase64 = match[2];
      }
    }

    const buffer = Buffer.from(cleanBase64, 'base64');
    const ext = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg';
    const uniquePath = `avatars/user_${userId || 'perfil'}_${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('redacoes-fotos')
      .upload(uniquePath, buffer, {
        contentType: mimeType,
        upsert: true
      });

    if (uploadError) {
      console.warn('[Supabase Avatar Storage Warning]: Falha no upload:', uploadError.message);
      return null;
    }

    const { data: publicData } = supabase.storage
      .from('redacoes-fotos')
      .getPublicUrl(uniquePath);

    return publicData?.publicUrl || null;
  } catch (err) {
    console.error('[Supabase Avatar Storage Error]: Erro ao gravar avatar no Storage:', err.message);
    return null;
  }
}
