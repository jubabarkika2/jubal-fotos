export interface ImageAttachment {
  id: string; // `${messageId}-${attachmentId}`
  messageId: string;
  attachmentId: string;
  filename: string;
  mimeType: string;
  subject: string;
  from: string;
  date: string;
  snippet?: string;
}

export interface GmailFetchState {
  loading: boolean;
  error: string | null;
  items: ImageAttachment[];
  nextPageToken: string | null;
  prevPageTokens: string[]; // for backwards navigation
  currentPageToken: string | null;
}
