import { createTableHelpers, listCountsByRfp, type RfpCount } from "@/lib/table-helpers";
import type { RfpComment, RfpCommentInput } from "@/lib/types";

const selectFields = "id, rfp_id, author_name, body, created_at";
const helpers = createTableHelpers<RfpComment, RfpCommentInput>("rfp_comments", selectFields);

export const listComments = helpers.list;

export const listCommentsByRfp = helpers.listByRfp;

export const createComment = helpers.create;

export const deleteComment = helpers.remove;

export function listCommentCountsByRfp(): Promise<RfpCount[]> {
  return listCountsByRfp("list_comment_counts_by_rfp");
}
