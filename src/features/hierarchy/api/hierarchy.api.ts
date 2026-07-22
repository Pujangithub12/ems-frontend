import api from "../../../api/axios";
import { HierarchyPerson } from "../../../types";

/** GET /api/hierarchy — flat org-chart people list for the current workspace. */
export async function getHierarchy(): Promise<HierarchyPerson[]> {
  const res = await api.get<{ people: HierarchyPerson[] }>("/api/hierarchy");
  return res.data.people || [];
}

/** PUT /api/hierarchy — full-replace of reporting lines. */
export async function saveHierarchy(people: HierarchyPerson[]): Promise<HierarchyPerson[]> {
  const res = await api.put<{ people: HierarchyPerson[] }>("/api/hierarchy", {
    people: people.map((p) => ({
      id: p.id,
      primaryManagerId: p.primaryManagerId,
      secondaryManagerIds: p.secondaryManagerIds,
    })),
  });
  return res.data.people || people;
}
