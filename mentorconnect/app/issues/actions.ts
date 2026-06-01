"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function resolveIssue(
  issueId: string,
  resolutionSummary: string,
  contributingMentors: string[] = []
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("You must be logged in to resolve an issue.");
  }

  // Insert the resolution
  const { error: resolutionError } = await supabase
    .from("issue_resolutions")
    .insert({
      issue_id: issueId,
      resolved_by: user.id,
      resolution_summary: resolutionSummary,
      contributing_mentors: contributingMentors.length > 0 ? contributingMentors : [user.id],
    });

  if (resolutionError) {
    console.error("Resolution Error:", resolutionError);
    throw new Error(resolutionError.message);
  }

  // Update the issue status
  const { error: issueError } = await supabase
    .from("issues")
    .update({ status: "resolved", closed_at: new Date().toISOString() })
    .eq("id", issueId);

  if (issueError) {
    console.error("Issue Status Update Error:", issueError);
    throw new Error(issueError.message);
  }

  revalidatePath(`/issues/${issueId}`);
  revalidatePath("/issues");
}

export async function addInternalNote(issueId: string, noteBody: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("You must be logged in to add a note.");
  }

  const { error } = await supabase.from("issue_comments").insert({
    body: noteBody,
    issue_id: issueId,
    author_id: user.id,
    is_internal_note: true,
  });

  if (error) {
    throw new Error(error.message);
  }
  
  revalidatePath(`/issues/${issueId}`);
}
