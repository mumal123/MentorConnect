"use client";

import { useTransition, useState } from "react";
import { toggleVote } from "@/app/actions/issues";
import { Button } from "@/components/ui/button";
import { ArrowUpIcon, ArrowDownIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface IssueVoteControlsProps {
  issueId: string;
  initialScore: number;
  initialUserVote: 1 | -1 | null;
}

export function IssueVoteControls({ issueId, initialScore, initialUserVote }: IssueVoteControlsProps) {
  const [isPending, startTransition] = useTransition();
  const [optimisticVote, setOptimisticVote] = useState<{ score: number; userVote: 1 | -1 | null }>({
    score: initialScore,
    userVote: initialUserVote,
  });

  const handleVote = (voteType: 1 | -1) => {
    // Prevent multiple clicks while transitioning
    if (isPending) return;

    let newScore = optimisticVote.score;
    let newUserVote: 1 | -1 | null = null;

    if (optimisticVote.userVote === voteType) {
      // Un-vote
      newScore -= voteType;
    } else {
      // Change vote or new vote
      if (optimisticVote.userVote) {
        newScore -= optimisticVote.userVote; // Remove old vote
      }
      newScore += voteType; // Add new vote
      newUserVote = voteType;
    }

    setOptimisticVote({ score: newScore, userVote: newUserVote });

    startTransition(async () => {
      try {
        await toggleVote(issueId, voteType);
      } catch (error) {
        // Revert on error
        setOptimisticVote({ score: initialScore, userVote: initialUserVote });
        console.error(error);
      }
    });
  };

  return (
    <div className="flex items-center gap-1 bg-accent/50 rounded-md p-0.5">
      <Button
        variant="ghost"
        size="icon"
        className={cn("h-8 w-8 hover:bg-transparent hover:text-green-500", optimisticVote.userVote === 1 && "text-green-600 bg-green-500/10 hover:bg-green-500/20")}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          handleVote(1);
        }}
        disabled={isPending}
      >
        <ArrowUpIcon className="h-4 w-4" />
        <span className="sr-only">Upvote</span>
      </Button>
      
      <span className="text-sm font-medium min-w-[1ch] text-center">
        {optimisticVote.score}
      </span>
      
      <Button
        variant="ghost"
        size="icon"
        className={cn("h-8 w-8 hover:bg-transparent hover:text-red-500", optimisticVote.userVote === -1 && "text-red-600 bg-red-500/10 hover:bg-red-500/20")}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          handleVote(-1);
        }}
        disabled={isPending}
      >
        <ArrowDownIcon className="h-4 w-4" />
        <span className="sr-only">Downvote</span>
      </Button>
    </div>
  );
}
