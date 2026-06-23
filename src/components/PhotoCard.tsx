import React, { useState, useEffect } from 'react';
import { type ImageAttachment } from '../types';
import { getAttachmentDataUrl, formatDate } from '../gmail_api';
import { Eye, Calendar, User, Download, FileImage, Loader2 } from 'lucide-react';

interface PhotoCardProps {
  item: ImageAttachment;
  accessToken: string;
  onClick: (dataUrl: string) => void;
  // Membro cache compartilhado no componente superior para evitar requests repetidos
  cachedData: Record<string, string>;
  onCacheData: (id: string, dataUrl: string) => void;
}

export const PhotoCard: React.FC<PhotoCardProps> = ({
  item,
  accessToken,
  onClick,
  cachedData,
  onCacheData,
}) => {
  const [dataUrl, setDataUrl] = useState<string | null>(cachedData[item.id] || null);
  const [loading, setLoading] = useState<boolean>(!cachedData[item.id]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Se já estiver no cache, não busca de novo
    if (cachedData[item.id]) {
      setDataUrl(cachedData[item.id]);
      setLoading(false);
      return;
    }

    let isMounted = true;
    async function loadAttachment() {
      try {
        setLoading(true);
        setError(null);
        const url = await getAttachmentDataUrl(
          accessToken,
          item.messageId,
          item.attachmentId,
          item.mimeType
        );
        if (isMounted) {
          setDataUrl(url);
          onCacheData(item.id, url);
        }
      } catch (err: any) {
        if (isMounted) {
          console.error(`Erro ao carregar anexo ${item.id}:`, err);
          setError('Erro ao carregar imagem');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadAttachment();

    return () => {
      isMounted = false;
    };
  }, [item.id, accessToken]);

  // Função auxiliar para cortar textos longos
  const truncate = (text: string, count: number): string => {
    if (!text) return '';
    return text.length > count ? text.substring(0, count) + '...' : text;
  };

  // Extrai apenas o nome amigável do remetente (removendo o email <...>)
  const cleanSenderName = (fromStr: string): string => {
    if (!fromStr) return '';
    const match = fromStr.match(/^"?(.*?)"?\s*<.*?>$/);
    if (match && match[1]) {
      return match[1];
    }
    return fromStr.split('<')[0].trim() || fromStr;
  };

  return (
    <div
      id={`card-${item.id}`}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-xs transition-all duration-300 hover:-translate-y-1 hover:border-slate-200 hover:shadow-md"
    >
      {/* Área da Imagem */}
      <div className="relative aspect-square w-full overflow-hidden bg-slate-50">
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-400">
            <Loader2 className="h-8 w-8 animate-spin text-slate-400/80" />
            <span className="text-xs font-medium tracking-wide">Carregando anexo...</span>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center text-slate-400">
            <FileImage className="mb-2 h-10 w-10 text-slate-300" />
            <span className="text-xs font-semibold text-rose-500">{error}</span>
            <span className="mt-1 text-[10px] text-slate-400">{item.filename}</span>
          </div>
        )}

        {dataUrl && !loading && !error && (
          <>
            <img
              src={dataUrl}
              alt={item.filename}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              referrerPolicy="no-referrer"
              loading="lazy"
            />
            {/* Overlay com Hover */}
            <div className="absolute inset-0 bg-slate-950/40 opacity-0 transition-opacity duration-300 group-hover:opacity-100 flex items-center justify-center">
              <button
                id={`btn-view-${item.id}`}
                onClick={() => onClick(dataUrl)}
                className="flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 shadow-xl transition-all duration-200 hover:scale-105 hover:bg-slate-50"
              >
                <Eye className="h-4 w-4" />
                Visualizar
              </button>
            </div>
          </>
        )}
      </div>

      {/* Detalhes do E-mail */}
      <div className="flex flex-1 flex-col p-4">
        <h4 className="line-clamp-1 text-sm font-semibold text-slate-800" title={item.filename}>
          {item.filename}
        </h4>
        <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500 font-medium">
          <User className="h-3 w-3 stroke-[2.5px] text-slate-400" />
          <span className="truncate" title={item.from}>
            {cleanSenderName(item.from)}
          </span>
        </p>
        <p className="mt-1 line-clamp-1 text-xs text-slate-400" title={item.subject}>
          <span className="font-semibold text-slate-500">Assunto: </span>
          {item.subject}
        </p>

        {/* Rodapé do Card */}
        <div className="mt-auto pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {formatDate(item.date)}
          </span>
          {dataUrl && (
            <a
              id={`dl-link-${item.id}`}
              href={dataUrl}
              download={item.filename}
              title="Baixar Foto"
              className="rounded-full p-1.5 hover:bg-slate-100 hover:text-slate-700 transition"
              onClick={(e) => e.stopPropagation()}
            >
              <Download className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
};
