import React from 'react';
import { type ImageAttachment } from '../types';
import { formatDate } from '../gmail_api';
import { X, Download, User, Mail, Calendar, Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';

interface PhotoModalProps {
  item: ImageAttachment;
  dataUrl: string;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
}

export const PhotoModal: React.FC<PhotoModalProps> = ({
  item,
  dataUrl,
  onClose,
  onPrev,
  onNext,
  hasPrev = false,
  hasNext = false,
}) => {
  return (
    <div
      id="photo-modal-container"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div
        id="photo-modal-content"
        className="relative flex flex-col md:flex-row w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-2xl animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Lado Esquerdo: Imagem com Controles de Navegação */}
        <div className="relative flex-1 bg-neutral-900 flex items-center justify-center min-h-[300px] md:min-h-[500px]">
          <img
            src={dataUrl}
            alt={item.filename}
            className="max-h-[75vh] max-w-full object-contain"
            referrerPolicy="no-referrer"
          />

          {/* Botão de Fechar no Mobile */}
          <button
            id="modal-close-btn-mobile"
            onClick={onClose}
            className="absolute top-4 left-4 md:hidden flex items-center justify-center h-10 w-10 text-white bg-slate-900/50 hover:bg-slate-900/80 rounded-full transition"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Setas de navegação */}
          {hasPrev && onPrev && (
            <button
              id="modal-prev-btn"
              onClick={onPrev}
              className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center justify-center h-12 w-12 text-white bg-slate-950/40 hover:bg-slate-950/75 rounded-full transition duration-200"
            >
              <ChevronLeft className="h-6 w-6 stroke-[2.5]" />
            </button>
          )}

          {hasNext && onNext && (
            <button
              id="modal-next-btn"
              onClick={onNext}
              className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center justify-center h-12 w-12 text-white bg-slate-950/40 hover:bg-slate-950/75 rounded-full transition duration-200"
            >
              <ChevronRight className="h-6 w-6 stroke-[2.5]" />
            </button>
          )}
        </div>

        {/* Lado Direito: Informações e Metadados do E-mail */}
        <div className="w-full md:w-[380px] p-6 md:p-8 flex flex-col justify-between bg-slate-50 border-l border-slate-100">
          <div>
            {/* Cabeçalho */}
            <div className="flex items-start justify-between gap-4 mb-6">
              <div>
                <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-600">
                  <Sparkles className="h-3 w-3" />
                  Metadados do Gmail
                </span>
                <h3 className="mt-2 text-xl font-bold tracking-tight text-slate-900 line-clamp-2" title={item.filename}>
                  {item.filename}
                </h3>
              </div>
              <button
                id="modal-close-btn"
                onClick={onClose}
                className="hidden md:flex items-center justify-center h-10 w-10 text-slate-400 bg-slate-100 hover:bg-slate-200 rounded-full transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Informações da Mensagem */}
            <div className="space-y-5">
              {/* Remetente */}
              <div className="flex gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-200/50 text-slate-600 shrink-0">
                  <User className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <span className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">Remetente</span>
                  <p className="text-sm font-semibold text-slate-800 truncate" title={item.from}>
                    {item.from}
                  </p>
                </div>
              </div>

              {/* Assunto do E-mail */}
              <div className="flex gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-200/50 text-slate-600 shrink-0">
                  <Mail className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <span className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">Assunto do E-mail</span>
                  <p className="text-sm font-medium text-slate-700 block" title={item.subject}>
                    {item.subject}
                  </p>
                </div>
              </div>

              {/* Data do envio */}
              <div className="flex gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-200/50 text-slate-600 shrink-0">
                  <Calendar className="h-5 w-5" />
                </div>
                <div>
                  <span className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">Recebido em</span>
                  <p className="text-sm font-semibold text-slate-800">
                    {formatDate(item.date)}
                  </p>
                </div>
              </div>

              {/* Pequeno trecho (snippet) */}
              {item.snippet && (
                <div className="pt-4 border-t border-slate-200/70">
                  <span className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">Resumo da Conversa</span>
                  <p className="mt-1 text-xs italic text-slate-500 leading-relaxed bg-white/70 p-3 rounded-xl border border-slate-100">
                    "{item.snippet}"
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Botão de Ação: Download */}
          <div className="mt-8 pt-6 border-t border-slate-200/60">
            <a
              id="modal-download-btn"
              href={dataUrl}
              download={item.filename}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white shadow-lg transition-transform hover:-translate-y-0.5 hover:bg-slate-800"
            >
              <Download className="h-4 w-4" />
              Baixar Foto Anexa
            </a>
            <p className="mt-2 text-center text-[10px] text-slate-400 font-medium">
              Formato MIME: <span className="font-semibold">{item.mimeType}</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
