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

export const statuses: RfpStatus[] = ["TBD", "Yes", "No"];
export const pipelineStages: PipelineStage[] = ["Prospects", "Active", "Submitted", "Won", "Lost"];
