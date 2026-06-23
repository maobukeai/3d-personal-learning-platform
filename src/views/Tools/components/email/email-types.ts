export interface EmailAccount {
  id: string;
  email: string;
  password?: string;
  clientId: string;
  refreshToken: string;
  status: 'ACTIVE' | 'EXPIRED' | 'ERROR';
  statusMessage?: string;
  proxy?: string;
  userAgent?: string;
  dailyLimit: number;
  sentCountToday: number;
  minDelay: number;
  maxDelay: number;
  createdAt: string;
}

export interface EmailAccountUpdatePayload {
  clientId: string;
  proxy: string;
  dailyLimit: number;
  minDelay: number;
  maxDelay: number;
  password?: string;
  refreshToken?: string;
}

export interface MailMessageBody {
  contentType: 'text' | 'html';
  content: string;
}

export interface MailMessageRecipient {
  emailAddress: {
    name: string;
    address: string;
  };
}

export interface MailMessage {
  id: string;
  subject: string;
  bodyPreview: string;
  body: MailMessageBody;
  from: {
    emailAddress: {
      name: string;
      address: string;
    };
  };
  toRecipients: MailMessageRecipient[];
  receivedDateTime: string;
  hasAttachments: boolean;
  isRead: boolean;
}

export interface ComposeForm {
  accountId: string;
  to: string;
  subject: string;
  content: string;
}

export interface SingleAccountForm {
  email: string;
  password: string;
  clientId: string;
  refreshToken: string;
  proxy: string;
  minDelay: number;
  maxDelay: number;
  dailyLimit: number;
}

export interface EditAccountForm {
  id: string;
  email: string;
  password: string;
  clientId: string;
  refreshToken: string;
  proxy: string;
  minDelay: number;
  maxDelay: number;
  dailyLimit: number;
}

export interface ImportForm {
  text: string;
  proxy: string;
  minDelay: number;
  maxDelay: number;
  dailyLimit: number;
}
