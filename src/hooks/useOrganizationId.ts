import { useParams } from "react-router-dom";

/** Reads the active organization id from the URL's :organizationId param. */
export function useOrganizationId(): number {
  const { organizationId } = useParams<{ organizationId: string }>();
  return Number(organizationId);
}
