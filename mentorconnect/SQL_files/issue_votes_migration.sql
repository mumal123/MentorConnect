-- Migration: Add Upvote/Downvote feature to issues

-- 1. Add score column to issues
ALTER TABLE issues ADD COLUMN IF NOT EXISTS score INTEGER NOT NULL DEFAULT 0;

-- 2. Create issue_votes table
CREATE TABLE IF NOT EXISTS issue_votes (
    issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vote_type SMALLINT NOT NULL CHECK (vote_type IN (1, -1)),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (issue_id, user_id)
);

-- 3. Create index for fast lookups by user and score sorting
CREATE INDEX IF NOT EXISTS idx_issue_votes_user ON issue_votes(user_id);
CREATE INDEX IF NOT EXISTS idx_issues_score ON issues(score DESC);

-- 4. Create trigger to automatically update issues.score
CREATE OR REPLACE FUNCTION update_issue_score()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE issues SET score = score + NEW.vote_type WHERE id = NEW.issue_id;
    ELSIF TG_OP = 'UPDATE' THEN
        UPDATE issues SET score = score - OLD.vote_type + NEW.vote_type WHERE id = NEW.issue_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE issues SET score = score - OLD.vote_type WHERE id = OLD.issue_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_issue_votes ON issue_votes;
CREATE TRIGGER trg_issue_votes
AFTER INSERT OR UPDATE OR DELETE ON issue_votes
FOR EACH ROW EXECUTE FUNCTION update_issue_score();

-- 5. Enable Row Level Security (RLS) and add policies
ALTER TABLE issue_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to votes" 
ON issue_votes FOR SELECT 
USING (true);

CREATE POLICY "Allow users to insert their own votes" 
ON issue_votes FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow users to update their own votes" 
ON issue_votes FOR UPDATE 
TO authenticated 
USING (auth.uid() = user_id) 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow users to delete their own votes" 
ON issue_votes FOR DELETE 
TO authenticated 
USING (auth.uid() = user_id);
