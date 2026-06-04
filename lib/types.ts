export type RfpStatus = "Yes" | "No" | "TBD";
export type PipelineStage = "Prospects" | "Active" | "Submitted" | "Won" | "Lost";

export type Rfp = {
  id: string;
  client_name: string;
  status: RfpStatus;
  closing_date: string | null;
  tender_code: string | null;
  tender_link: string | null;
  gdrive_link: string | null;
  description: string | null;
  contact_person: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  document_links: TenderDocumentLink[];
  summary: string | null;
  summary_generated_at: string | null;
  response_draft_title: string | null;
  response_draft_content: string | null;
  response_draft_saved_at: string | null;
  notes: string | null;
  pipeline_stage: PipelineStage;
  created_at: string;
};

export type RfpInput = {
  client_name: string;
  status: RfpStatus;
  closing_date: string | null;
  tender_code: string | null;
  tender_link: string | null;
  gdrive_link: string | null;
  description: string | null;
  contact_person: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  document_links: TenderDocumentLink[];
  summary: string | null;
  summary_generated_at: string | null;
  response_draft_title: string | null;
  response_draft_content: string | null;
  response_draft_saved_at: string | null;
  notes: string | null;
  pipeline_stage: PipelineStage;
};

export type TenderDocumentLink = {
  name: string;
  url: string;
};

export type RfpImportInput = Partial<RfpInput> & {
  client_name: string;
  closing_date_text?: string | null;
};

export type RfpDocumentSourceType = "docx" | "pdf" | "xlsx" | "csv" | "markdown";
export type RfpFileKind = "source" | "response";

export type RfpDocument = {
  id: string;
  rfp_id: string;
  source_file_id: string | null;
  title: string;
  source_filename: string | null;
  source_type: RfpDocumentSourceType;
  markdown: string;
  created_at: string;
};

export type RfpDocumentInput = {
  rfp_id: string;
  source_file_id?: string | null;
  title: string;
  source_filename: string | null;
  source_type: RfpDocumentSourceType;
  markdown: string;
};

export type RfpFile = {
  id: string;
  rfp_id: string;
  kind: RfpFileKind;
  title: string;
  original_filename: string;
  mime_type: string | null;
  storage_path: string;
  file_size_bytes: number | null;
  status: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
};

export type RfpFileInput = {
  rfp_id: string;
  kind: RfpFileKind;
  title: string;
  original_filename: string;
  mime_type: string | null;
  storage_path: string;
  file_size_bytes: number | null;
  status?: string | null;
  notes?: string | null;
  created_by?: string;
};

export type RfpComment = {
  id: string;
  rfp_id: string;
  author_name: string;
  body: string;
  created_at: string;
};

export type RfpCommentInput = {
  rfp_id: string;
  author_name: string;
  body: string;
};

export const statuses: RfpStatus[] = ["TBD", "Yes", "No"];
export const pipelineStages: PipelineStage[] = ["Prospects", "Active", "Submitted", "Won", "Lost"];
