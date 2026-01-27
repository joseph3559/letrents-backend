export type DocumentType =
  | 'invoice'
  | 'payment_receipt'
  | 'refund_receipt'
  | 'lease'
  | 'statement'
  | 'report';

export type TemplateVersion = number;

export interface TemplateKey {
  documentType: DocumentType;
  version: TemplateVersion;
}

