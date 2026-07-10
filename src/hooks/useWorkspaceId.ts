import { useParams } from "react-router-dom";

/** Reads the active workspace id from the URL's :workspaceId param. */
export function useWorkspaceId(): number {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  return Number(workspaceId);
}
