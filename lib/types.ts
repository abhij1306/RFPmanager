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
  notes: string | null;
  pipeline_stage: PipelineStage;
};

export type RfpDocumentSourceType = "docx" | "pdf" | "xlsx" | "csv" | "markdown";

export type RfpDocument = {
  id: string;
  rfp_id: string;
  title: string;
  source_filename: string | null;
  source_type: RfpDocumentSourceType;
  markdown: string;
  created_at: string;
};

export type RfpDocumentInput = {
  rfp_id: string;
  title: string;
  source_filename: string | null;
  source_type: RfpDocumentSourceType;
  markdown: string;
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
