import { useMemo } from 'react';
import { todayISO } from '../domain/dates';
import { useStore } from './useStore';

export function useToday(): string {
  return useMemo(() => todayISO(), []);
}

export function useProject(projectId: string | undefined) {
  return useStore((s) => s.projects.find((p) => p.id === projectId) ?? null);
}

export function useProjectSprints(projectId: string | undefined) {
  const sprints = useStore((s) => s.sprints);
  return useMemo(
    () => sprints.filter((s) => s.projectId === projectId).sort((a, b) => b.number - a.number),
    [sprints, projectId],
  );
}

export function useProjectItems(projectId: string | undefined) {
  const items = useStore((s) => s.items);
  return useMemo(() => items.filter((i) => i.projectId === projectId), [items, projectId]);
}

export function useProjectMembers(projectId: string | undefined) {
  const members = useStore((s) => s.members);
  const project = useProject(projectId);
  return useMemo(
    () => (project ? project.memberIds.map((id) => members.find((m) => m.id === id)).filter((m) => !!m) : []),
    [members, project],
  );
}
