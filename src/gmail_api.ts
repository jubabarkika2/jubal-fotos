import { type ImageAttachment } from './types';

// Utilitário para decodificar base64url da API do Gmail para base64 padrão
export function base64urlToBase64(base64url: string): string {
  let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  // Adiciona preenchimento de '=' se necessário
  while (base64.length % 4) {
    base64 += '=';
  }
  return base64;
}

// Retorna o valor de um cabeçalho específico pelo nome
function getHeader(headers: { name: string; value: string }[], name: string): string {
  if (!headers) return '';
  const header = headers.find(h => h.name.toLowerCase() === name.toLowerCase());
  return header ? header.value : '';
}

// Altera a data bruta do email para uma formatação amigável
export function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateString;
  }
}

// Extrai recursivamente anexos que sejam do tipo imagem (PNG, JPG, JPEG, GIF, WEBP, etc)
function extractImageAttachments(
  messageId: string,
  payload: any,
  headersInfo: { subject: string; from: string; date: string },
  snippet: string
): ImageAttachment[] {
  const attachments: ImageAttachment[] = [];

  function traverse(part: any) {
    if (!part) return;

    // Verifica se é uma imagem e se possui um attachmentId válido
    const mimeType = part.mimeType || '';
    const isImage = mimeType.startsWith('image/');
    const attachmentId = part.body?.attachmentId;

    if (isImage && attachmentId) {
      attachments.push({
        id: `${messageId}-${attachmentId}`,
        messageId,
        attachmentId,
        filename: part.filename || 'Sem Nome.jpg',
        mimeType: part.mimeType,
        subject: headersInfo.subject || '(Sem Assunto)',
        from: headersInfo.from || 'Remetente Desconhecido',
        date: headersInfo.date,
        snippet: snippet || '',
      });
    }

    if (part.parts && Array.isArray(part.parts)) {
      for (const subPart of part.parts) {
        traverse(subPart);
      }
    }
  }

  // Se o payload não possuir parts estruturados mas o próprio payload principal for a imagem
  if (payload && payload.mimeType && payload.mimeType.startsWith('image/') && payload.body?.attachmentId) {
    attachments.push({
      id: `${messageId}-${payload.body.attachmentId}`,
      messageId,
      attachmentId: payload.body.attachmentId,
      filename: payload.filename || 'Sem Nome.jpg',
      mimeType: payload.mimeType,
      subject: headersInfo.subject || '(Sem Assunto)',
      from: headersInfo.from || 'Remetente Desconhecido',
      date: headersInfo.date,
      snippet: snippet || '',
    });
  } else {
    traverse(payload);
  }

  return attachments;
}

// Lista os emails baseados na query e retorna a lista de IDs
export async function fetchGmailMessagesPage(
  accessToken: string,
  pageToken: string | null = null,
  searchQuery: string = ''
): Promise<{ messages: { id: string }[]; nextPageToken: string | null }> {
  // Construção da query do Gmail para filtrar emails com anexos de imagem
  // q = has:attachment filename:(jpg OR jpeg OR png OR gif OR webp)
  let q = 'has:attachment filename:(jpg OR jpeg OR png OR gif OR webp)';
  if (searchQuery.trim()) {
    // Mesclar a busca do usuário junto com a busca de fotos
    q += ` ${searchQuery.trim()}`;
  }

  const params = new URLSearchParams({
    q,
    maxResults: '12', // limite para carregamento rápido e fluído
  });

  if (pageToken) {
    params.append('pageToken', pageToken);
  }

  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?${params.toString()}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Erro ao listar mensagens do Gmail: ${response.statusText}`);
  }

  const data = await response.json();
  const messages = data.messages || [];
  const nextPageToken = data.nextPageToken || null;

  return { messages, nextPageToken };
}

// Busca os detalhes de cada mensagem individualmente e extrai as fotos
export async function getAttachmentsFromMessage(
  accessToken: string,
  messageId: string
): Promise<ImageAttachment[]> {
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    console.warn(`Mensagem ${messageId} falhou ao carregar detalhes:`, response.statusText);
    return [];
  }

  const message = await response.json();
  const headers = message.payload?.headers || [];
  const subject = getHeader(headers, 'subject');
  const from = getHeader(headers, 'from');
  const date = getHeader(headers, 'date');

  return extractImageAttachments(
    messageId,
    message.payload,
    { subject, from, date },
    message.snippet || ''
  );
}

// Busca os bytes brutos do anexo e retorna um link data-URL utilizável
export async function getAttachmentDataUrl(
  accessToken: string,
  messageId: string,
  attachmentId: string,
  mimeType: string
): Promise<string> {
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/attachments/${attachmentId}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Falha ao obter anexo: ${response.statusText}`);
  }

  const data = await response.json();
  if (!data.data) {
    throw new Error('Conteúdo do anexo vazio');
  }

  const base64 = base64urlToBase64(data.data);
  return `data:${mimeType};base64,${base64}`;
}
