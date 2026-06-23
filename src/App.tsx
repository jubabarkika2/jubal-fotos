import React, { useState, useEffect } from 'react';
import { type User } from 'firebase/auth';
import { initAuth, googleSignIn, logout } from './firebase';
import { fetchGmailMessagesPage, getAttachmentsFromMessage } from './gmail_api';
import { type ImageAttachment, type GmailFetchState } from './types';
import { PhotoCard } from './components/PhotoCard';
import { PhotoModal } from './components/PhotoModal';
import {
  ImagePlus,
  Search,
  LogOut,
  RefreshCw,
  MailWarning,
  Eye,
  Info,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  HelpCircle,
  Mail,
  Loader2,
  Lock,
} from 'lucide-react';

export default function App() {
  // Estados de Autenticação
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState<boolean>(true);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);

  // Estados de Busca e Dados do Gmail
  const [photoState, setPhotoState] = useState<GmailFetchState>({
    loading: false,
    error: null,
    items: [],
    nextPageToken: null,
    prevPageTokens: [],
    currentPageToken: null,
  });

  const [loadingProgress, setLoadingProgress] = useState<{ loaded: number; total: number } | null>(null);
  const [searchQueryInput, setSearchQueryInput] = useState<string>('');
  const [activeSearchQuery, setActiveSearchQuery] = useState<string>('');

  // Cache global em memória das imagens já decodificadas para evitar novas requisições na API ao rolar a página
  const [cachedPhotoData, setCachedPhotoData] = useState<Record<string, string>>({});

  // Estado do Lighbox (Modal de Foto)
  const [activePhotoIndex, setActivePhotoIndex] = useState<number | null>(null);
  const [activePhotoUrl, setActivePhotoUrl] = useState<string | null>(null);

  // Inicialização do Firebase Auth
  useEffect(() => {
    const unsubscribe = initAuth(
      (currentUser, cachedToken) => {
        setUser(currentUser);
        setToken(cachedToken);
        setNeedsAuth(false);
      },
      () => {
        setUser(null);
        setToken(null);
        setNeedsAuth(true);
      }
    );
    return () => unsubscribe();
  }, []);

  // Busca fotos sempre que houver mudança de página ou busca ativada
  useEffect(() => {
    if (token) {
      loadGmailPhotos(token, photoState.currentPageToken, activeSearchQuery);
    }
  }, [token, photoState.currentPageToken, activeSearchQuery]);

  // Função para fazer login com Google
  const handleLogin = async () => {
    setIsLoggingIn(true);
    setPhotoState(prev => ({ ...prev, error: null }));
    try {
      const result = await googleSignIn();
      if (result) {
        setToken(result.accessToken);
        setUser(result.user);
        setNeedsAuth(false);
      }
    } catch (err: any) {
      console.error('Falha de login:', err);
      setPhotoState(prev => ({
        ...prev,
        error: 'Erro de autenticação para acessar seu Gmail. Por favor, libere as permissões.',
      }));
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Função para deslogar
  const handleLogout = async () => {
    try {
      await logout();
      setUser(null);
      setToken(null);
      setNeedsAuth(true);
      setPhotoState({
        loading: false,
        error: null,
        items: [],
        nextPageToken: null,
        prevPageTokens: [],
        currentPageToken: null,
      });
      setCachedPhotoData({});
      setActivePhotoIndex(null);
      setActivePhotoUrl(null);
    } catch (err) {
      console.error('Erro de logout:', err);
    }
  };

  // Carrega lista de emails e busca os detalhes de cada anexo de imagem
  const loadGmailPhotos = async (
    accessToken: string,
    targetPageToken: string | null,
    searchQuery: string
  ) => {
    setPhotoState(prev => ({ ...prev, loading: true, error: null }));
    setLoadingProgress(null);

    try {
      // 1. Busca a página correspondente de mensagens
      const { messages, nextPageToken } = await fetchGmailMessagesPage(
        accessToken,
        targetPageToken,
        searchQuery
      );

      if (messages.length === 0) {
        setPhotoState(prev => ({
          ...prev,
          loading: false,
          items: [],
          nextPageToken: null,
        }));
        return;
      }

      // 2. Busca os detalhes e anexos para cada mensagem de forma paralela/otimizada
      const totalMessages = messages.length;
      let loadedCount = 0;
      setLoadingProgress({ loaded: 0, total: totalMessages });

      const detailPromises = messages.map(async (msg) => {
        try {
          const attachments = await getAttachmentsFromMessage(accessToken, msg.id);
          loadedCount++;
          setLoadingProgress({ loaded: loadedCount, total: totalMessages });
          return attachments;
        } catch (err) {
          console.error(`Erro ao carregar detalhes do email ${msg.id}:`, err);
          loadedCount++;
          setLoadingProgress({ loaded: loadedCount, total: totalMessages });
          return [];
        }
      });

      const results = await Promise.all(detailPromises);
      const allAttachments = results.flat();

      setPhotoState(prev => ({
        ...prev,
        loading: false,
        items: allAttachments,
        nextPageToken: nextPageToken,
      }));
    } catch (err: any) {
      console.error('Erro ao processar as fotos do Gmail:', err);
      // Se obtivermos 401 ou token inválido, solicitamos re-login
      if (err.message && err.message.includes('401')) {
        setNeedsAuth(true);
        setPhotoState(prev => ({ ...prev, loading: false, error: 'Sua sessão do Gmail expirou. Por favor, entre novamente.' }));
      } else {
        setPhotoState(prev => ({
          ...prev,
          loading: false,
          error: 'Não foi possível carregar as fotos do Gmail. Verifique sua conexão ou se a sua conta tem permissões ativas.',
        }));
      }
    } finally {
      setLoadingProgress(null);
    }
  };

  // Aciona busca ativa
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPhotoState(prev => ({
      ...prev,
      currentPageToken: null,
      prevPageTokens: [],
    }));
    setActiveSearchQuery(searchQueryInput);
  };

  // Limpa busca ativa
  const handleClearSearch = () => {
    setSearchQueryInput('');
    setActiveSearchQuery('');
    setPhotoState(prev => ({
      ...prev,
      currentPageToken: null,
      prevPageTokens: [],
    }));
  };

  // Transições de página: Avançar
  const handleNextPage = () => {
    if (!photoState.nextPageToken) return;

    setPhotoState(prev => {
      const currentToken = prev.currentPageToken;
      const updatedPrevList = currentToken
        ? [...prev.prevPageTokens, currentToken]
        : prev.currentPageToken === null
        ? ['FIRST_PAGE']
        : prev.prevPageTokens;

      return {
        ...prev,
        prevPageTokens: updatedPrevList,
        currentPageToken: prev.nextPageToken,
      };
    });
  };

  // Transições de página: Voltar
  const handlePrevPage = () => {
    if (photoState.prevPageTokens.length === 0) return;

    setPhotoState(prev => {
      const updatedPrevList = [...prev.prevPageTokens];
      const previousToken = updatedPrevList.pop();
      const targetToken = previousToken === 'FIRST_PAGE' ? null : (previousToken || null);

      return {
        ...prev,
        prevPageTokens: updatedPrevList,
        currentPageToken: targetToken,
      };
    });
  };

  // Guarda os dados carregados das imagens de forma dinâmica no cache
  const handleCachePhotoData = (id: string, dataUrl: string) => {
    setCachedPhotoData(prev => ({
      ...prev,
      [id]: dataUrl,
    }));
  };

  // Abre Lightbox para visualização completa
  const handleOpenLightbox = (index: number, dataUrl: string) => {
    setActivePhotoIndex(index);
    setActivePhotoUrl(dataUrl);
  };

  // Avança imagem dentro do Lightbox
  const handleNextLightbox = () => {
    if (activePhotoIndex === null || activePhotoIndex >= photoState.items.length - 1) return;
    const nextIndex = activePhotoIndex + 1;
    const nextItem = photoState.items[nextIndex];
    // Recupera a imagem de cache; se estiver carregando, espera carregar na grid
    const cachedUrl = cachedPhotoData[nextItem.id];
    if (cachedUrl) {
      setActivePhotoIndex(nextIndex);
      setActivePhotoUrl(cachedUrl);
    }
  };

  // Retorna imagem dentro do Lightbox
  const handlePrevLightbox = () => {
    if (activePhotoIndex === null || activePhotoIndex <= 0) return;
    const prevIndex = activePhotoIndex - 1;
    const prevItem = photoState.items[prevIndex];
    const cachedUrl = cachedPhotoData[prevItem.id];
    if (cachedUrl) {
      setActivePhotoIndex(prevIndex);
      setActivePhotoUrl(cachedUrl);
    }
  };

  // Recarrega página atual
  const handleRefresh = () => {
    if (token) {
      loadGmailPhotos(token, photoState.currentPageToken, activeSearchQuery);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans antialiased selection:bg-indigo-100 selection:text-indigo-900 flex flex-col">
      {/* HEADER GERAL */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-100 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-200">
              <ImagePlus className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base font-extrabold tracking-tight text-slate-950 sm:text-lg">
                Gmail Photo Gallery
              </h1>
              <p className="hidden text-[11px] font-medium text-slate-500 sm:block">
                Seu e-mail como uma galeria organizada
              </p>
            </div>
          </div>

          {/* Área do Usuário Autenticado */}
          {user && (
            <div className="flex items-center gap-3">
              <div className="hidden text-right sm:block">
                <p className="text-xs font-semibold text-slate-800">{user.displayName || 'Usuário'}</p>
                <p className="text-[10px] font-medium text-slate-400">{user.email}</p>
              </div>
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'Avatar'}
                  className="h-9 w-9 rounded-full ring-2 ring-slate-100"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700 uppercase">
                  {(user.displayName || user.email || 'U').substring(0, 2)}
                </div>
              )}
              <button
                id="header-logout-btn"
                onClick={handleLogout}
                title="Desconectar do app"
                className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition cursor-pointer"
              >
                <LogOut className="h-4.5 w-4.5" />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* TELA DE AUTENTICAÇÃO */}
      {needsAuth ? (
        <main className="flex flex-1 items-center justify-center px-4 py-16">
          <div className="w-full max-w-md rounded-3xl border border-slate-100 bg-white p-8 shadow-xl text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 mb-6 shadow-sm">
              <ImagePlus className="h-8 w-8" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">
              Suas fotos do Gmail, em uma bela galeria
            </h2>
            <p className="mt-3 text-sm text-slate-500 leading-relaxed">
              Conecte sua conta do Google de forma totalmente segura. Buscaremos apenas os anexos de imagens (fotos) recebidos em seus e-mails para criar o seu álbum visual em tempo real.
            </p>

            {/* Aviso de Privacidade / Autorização */}
            <div className="mt-6 flex gap-3 rounded-2xl bg-slate-50 p-4 text-left border border-slate-100">
              <Lock className="mt-0.5 h-4 w-4 text-indigo-500 shrink-0" />
              <div className="text-xs text-slate-500 leading-relaxed">
                <span className="font-semibold text-slate-800">Seu Gmail é o banco de dados:</span> As fotos não são salvas em servidores de terceiros. A busca é direta, temporária e mantida apenas na memória do seu navegador.
              </div>
            </div>

            {/* Botão Oficial Google */}
            <div className="mt-8 flex justify-center">
              <button
                id="google-signin-btn"
                onClick={handleLogin}
                disabled={isLoggingIn}
                className="gsi-material-button w-full flex items-center justify-center"
              >
                <div className="gsi-material-button-state"></div>
                <div className="gsi-material-button-content-wrapper">
                  {isLoggingIn ? (
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-600 py-1.5">
                      <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
                      Iniciando sessão do Google...
                    </div>
                  ) : (
                    <>
                      <div className="gsi-material-button-icon">
                        <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style={{ display: "block" }}>
                          <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                          <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                          <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                          <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                          <path fill="none" d="M0 0h48v48H0z"></path>
                        </svg>
                      </div>
                      <span className="gsi-material-button-contents">Entrar com Google</span>
                    </>
                  )}
                </div>
              </button>
            </div>

            {photoState.error && (
              <div className="mt-4 rounded-xl bg-rose-50 p-3 text-xs font-semibold text-rose-600 border border-rose-100">
                {photoState.error}
              </div>
            )}
          </div>
        </main>
      ) : (
        /* CONTEÚDO PRINCIPAL (DASHBOARD) */
        <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          {/* PAINEL DE CONTROLE / FILTRO */}
          <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-xs">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-indigo-500" />
                  Galeria de Fotos Automatizada
                </h2>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Anexados em e-mails que você recebeu ({activeSearchQuery ? `Busca: "${activeSearchQuery}"` : 'Todas as fotos recentes'})
                </p>
              </div>

              {/* Botões de Ação Rápida */}
              <div className="flex items-center gap-2">
                <button
                  id="refresh-photos-btn"
                  onClick={handleRefresh}
                  disabled={photoState.loading}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-xs transition hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${photoState.loading ? 'animate-spin' : ''}`} />
                  Atualizar
                </button>
              </div>
            </div>

            {/* Barra de Pesquisa */}
            <form onSubmit={handleSearchSubmit} className="mt-5 flex gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="search-input-field"
                  type="text"
                  placeholder="Pesquisar por assunto do e-mail, remetente, ou palavra-chave..."
                  value={searchQueryInput}
                  onChange={(e) => setSearchQueryInput(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 pl-10 pr-4 text-xs font-medium text-slate-800 placeholder-slate-400 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100"
                />
              </div>
              <button
                id="search-submit-btn"
                type="submit"
                disabled={photoState.loading}
                className="rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-indigo-100 hover:bg-indigo-700 transition cursor-pointer"
              >
                Buscar
              </button>
              {activeSearchQuery && (
                <button
                  id="search-clear-btn"
                  type="button"
                  onClick={handleClearSearch}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-500 hover:bg-slate-50 transition cursor-pointer"
                >
                  Limpar
                </button>
              )}
            </form>
          </div>

          {/* INDICADOR DE CARREGAMENTO PROGRESSIVO GERAL */}
          {photoState.loading && loadingProgress && (
            <div className="mt-8 rounded-2xl bg-indigo-50 border border-indigo-100/30 p-5 flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-3">
                <Loader2 className="h-6 w-6 text-indigo-600 animate-spin" />
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Cruzando banco de dados do Gmail...</h4>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    Lendo conteúdos e localizando cabeçalhos e anexos de fotos.
                  </p>
                </div>
              </div>
              <span className="text-sm font-extrabold text-indigo-700">
                {loadingProgress.loaded} de {loadingProgress.total} analisados
              </span>
            </div>
          )}

          {/* GRID DE IMAGENS OU ESTADO VAZIO / ERROS */}
          {photoState.loading && !loadingProgress ? (
            <div className="py-24 flex flex-col items-center justify-center gap-3">
              <Loader2 className="h-10 w-10 text-indigo-600 animate-spin" />
              <span className="text-sm font-bold text-slate-600">Listando mensagens da sua caixa de entrada...</span>
            </div>
          ) : photoState.error ? (
            <div className="mt-8 rounded-2xl border border-rose-100 bg-rose-50 p-6 text-center">
              <MailWarning className="mx-auto h-12 w-12 text-rose-500 mb-3" />
              <h3 className="text-base font-bold text-slate-900">Erro ao sincronizar dados</h3>
              <p className="mt-2 text-xs text-slate-500 font-medium leading-relaxed max-w-md mx-auto">
                {photoState.error}
              </p>
              <button
                id="error-retry-btn"
                onClick={handleRefresh}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-700 transition shadow-sm"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Tentar novamente
              </button>
            </div>
          ) : photoState.items.length === 0 ? (
            /* Nenhum anexo encontrado */
            <div className="mt-8 rounded-3xl border-2 border-dashed border-slate-200 bg-white py-20 text-center px-4">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-50 text-slate-400 mb-4 border border-slate-100">
                <Mail className="h-6 w-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Nenhuma foto localizada</h3>
              <p className="mt-2 text-xs text-slate-500 font-medium leading-relaxed max-w-sm mx-auto">
                Não encontramos anexos de imagem ({activeSearchQuery ? `com termo "${activeSearchQuery}"` : 'JPEG, PNG, WEBP, GIF'}) nos e-mails listados na página atual da sua caixa de entrada.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                <button
                  id="empty-refresh-btn"
                  onClick={handleRefresh}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                >
                  Atualizar Caixa
                </button>
                {activeSearchQuery && (
                  <button
                    id="empty-clear-btn"
                    onClick={handleClearSearch}
                    className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700 transition cursor-pointer"
                  >
                    Ver Tudo
                  </button>
                )}
              </div>
            </div>
          ) : (
            /* Lista de Cards da Galeria */
            <div className="mt-8">
              {/* Informação sobre os resultados */}
              <div className="mb-4 flex items-center justify-between text-xs text-slate-500 font-medium px-1">
                <span>
                  Mostrando <strong className="text-slate-800">{photoState.items.length}</strong> fotos localizadas nos e-mails desta página
                </span>
                {photoState.currentPageToken && (
                  <span className="bg-slate-100 px-2 py-0.5 rounded-md font-semibold text-slate-600">
                    Página {photoState.prevPageTokens.length + 1}
                  </span>
                )}
              </div>

              {/* Grid principal */}
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {photoState.items.map((item, index) => (
                  <PhotoCard
                    key={item.id}
                    item={item}
                    accessToken={token!}
                    cachedData={cachedPhotoData}
                    onCacheData={handleCachePhotoData}
                    onClick={(url) => handleOpenLightbox(index, url)}
                  />
                ))}
              </div>

              {/* PAGINAÇÃO */}
              <div className="mt-12 flex items-center justify-center gap-4 pt-6 border-t border-slate-200/50">
                <button
                  id="pagination-prev-btn"
                  onClick={handlePrevPage}
                  disabled={photoState.prevPageTokens.length === 0 || photoState.loading}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-xs transition hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white cursor-pointer"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Página Anterior
                </button>
                <span className="text-xs font-bold text-slate-500">
                  Página {photoState.prevPageTokens.length + 1}
                </span>
                <button
                  id="pagination-next-btn"
                  onClick={handleNextPage}
                  disabled={!photoState.nextPageToken || photoState.loading}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-xs transition hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white cursor-pointer"
                >
                  Próxima Página
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* RODAPÉ DO APP */}
          <footer className="mt-20 py-8 border-t border-slate-200/60 flex flex-col md:flex-row items-center justify-between text-xs text-slate-400 gap-4">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Conexão Segura direta com a API do Gmail
            </div>
            <div>
              &copy; 2026 Gmail Photo Gallery &bull; Desenvolvido com segurança sem armazenamento externo
            </div>
          </footer>
        </main>
      )}

      {/* CONTROLE DO LIGHTBOX / MODAL */}
      {activePhotoIndex !== null && activePhotoUrl && (
        <PhotoModal
          item={photoState.items[activePhotoIndex]}
          dataUrl={activePhotoUrl}
          onClose={() => {
            setActivePhotoIndex(null);
            setActivePhotoUrl(null);
          }}
          onNext={handleNextLightbox}
          onPrev={handlePrevLightbox}
          hasNext={activePhotoIndex < photoState.items.length - 1}
          hasPrev={activePhotoIndex > 0}
        />
      )}
    </div>
  );
}
