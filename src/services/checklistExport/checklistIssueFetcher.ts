import { supabase } from '../../lib/supabase';

import type { ChecklistIssueDetail } from '../../lib/checklistExportRows';

interface ChecklistIssueResponseRow {
  checklist_id: string;
  observation: string | null;
  photo_url: string | null;
  checklist_items: { title: string | null } | null;
}

export async function fetchChecklistIssueDetails(
  checklistIds: string[],
): Promise<Map<string, ChecklistIssueDetail[]>> {
  const result = new Map<string, ChecklistIssueDetail[]>();
  const uniqueIds = [...new Set(checklistIds)];

  for (let index = 0; index < uniqueIds.length; index += 200) {
    const chunk = uniqueIds.slice(index, index + 200);
    const { data, error } = await supabase
      .from('checklist_responses')
      .select('checklist_id, observation, photo_url, checklist_items(title)')
      .eq('status', 'issue')
      .in('checklist_id', chunk);

    if (error) throw error;

    for (const row of (data ?? []) as unknown as ChecklistIssueResponseRow[]) {
      const issue: ChecklistIssueDetail = {
        itemTitle: row.checklist_items?.title ?? '',
        observation: row.observation ?? '',
        photoUrl: row.photo_url ?? '',
      };
      const issues = result.get(row.checklist_id);
      if (issues) issues.push(issue);
      else result.set(row.checklist_id, [issue]);
    }
  }

  return result;
}
