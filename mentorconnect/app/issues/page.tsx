import { createClient } from "@/lib/supabase/server";
import { IssueCard } from "./components/IssueCard";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default async function IssuesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: issues } = await supabase
    .from("issues")
    .select("id, title, description, status, created_at, visibility, issue_categories(name), score")
    .order("score", { ascending: false });

  const userVotes: Record<string, 1 | -1> = {};
  if (user && issues && issues.length > 0) {
    const issueIds = issues.map(i => i.id);
    const { data: votes } = await supabase
      .from("issue_votes")
      .select("issue_id, vote_type")
      .eq("user_id", user.id)
      .in("issue_id", issueIds);
    
    if (votes) {
      votes.forEach(v => {
        userVotes[v.issue_id] = v.vote_type as 1 | -1;
      });
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-mono text-2xl font-semibold tracking-tight">Issues</h1>
          <p className="text-sm text-muted-foreground">Track academic, personal, mental health, and career concerns.</p>
        </div>
        <Link href="/issues/create">
          <Button>New Issue</Button>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {issues?.map((issue) => (
          <IssueCard key={issue.id} issue={{ ...issue, userVote: userVotes[issue.id] || null }} />
        ))}
      </div>
    </div>
  );
}
