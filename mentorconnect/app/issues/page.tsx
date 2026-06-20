import { createClient } from "@/lib/supabase/server";
import { IssueCard } from "./components/IssueCard";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { CircleDot, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export default async function IssuesPage(props: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const searchParams = await props.searchParams;
  const state = searchParams.state === "closed" ? "closed" : "open";
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ count: openCount }, { count: closedCount }] = await Promise.all([
    supabase
      .from("issues")
      .select("*", { count: "exact", head: true })
      .in("status", ["open", "in_discussion", "needs_escalation"]),
    supabase
      .from("issues")
      .select("*", { count: "exact", head: true })
      .in("status", ["resolved", "closed"])
  ]);

  let query = supabase
    .from("issues")
    .select("id, title, description, status, created_at, visibility, issue_categories(name), score")
    .order("score", { ascending: false });

  if (state === "closed") {
    query = query.in("status", ["resolved", "closed"]);
  } else {
    query = query.in("status", ["open", "in_discussion", "needs_escalation"]);
  }

  const { data: issues } = await query;

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

      <div className="flex items-center gap-4 border-b pb-4">
        <Link
          href="/issues?state=open"
          className={cn(
            "flex items-center gap-2 text-sm font-medium transition-colors hover:text-primary",
            state === "open" ? "text-primary" : "text-muted-foreground"
          )}
        >
          <CircleDot className="h-4 w-4" />
          {openCount || 0} Open
        </Link>
        <Link
          href="/issues?state=closed"
          className={cn(
            "flex items-center gap-2 text-sm font-medium transition-colors hover:text-primary",
            state === "closed" ? "text-primary" : "text-muted-foreground"
          )}
        >
          <CheckCircle className="h-4 w-4" />
          {closedCount || 0} Closed
        </Link>
      </div>

      {issues && issues.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {issues.map((issue) => (
            <IssueCard key={issue.id} issue={{ ...issue, userVote: userVotes[issue.id] || null }} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 text-center border rounded-lg border-dashed">
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
            {state === "open" ? <CircleDot className="h-6 w-6 text-muted-foreground" /> : <CheckCircle className="h-6 w-6 text-muted-foreground" />}
          </div>
          <h3 className="text-lg font-semibold">No issues found</h3>
          <p className="text-sm text-muted-foreground max-w-sm mt-1">
            There are no {state} issues at the moment.
          </p>
        </div>
      )}
    </div>
  );
}
