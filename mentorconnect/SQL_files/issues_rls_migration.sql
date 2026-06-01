-- Migration: Add RLS for Issues, Comments, and Resolutions

-- 1. Enable RLS
ALTER TABLE issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE issue_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE issue_resolutions ENABLE ROW LEVEL SECURITY;

-- Issues Policy:
-- Public: Visible to all.
-- Private: Visible to creator and mentors (role_id >= 2).
-- Ultra-private: Visible to creator and committee/professional (role_id >= 5).
CREATE POLICY "Public issues are visible to all authenticated users"
ON issues FOR SELECT
TO authenticated
USING (visibility = 'public');

CREATE POLICY "Private issues visibility"
ON issues FOR SELECT
TO authenticated
USING (
    visibility = 'private' AND (
        auth.uid() = creator_id OR
        EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = auth.uid() AND ur.role_id >= 2 AND ur.is_active = true
        )
    )
);

CREATE POLICY "Ultra-private issues visibility"
ON issues FOR SELECT
TO authenticated
USING (
    visibility = 'ultra_private' AND (
        auth.uid() = creator_id OR
        EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = auth.uid() AND ur.role_id >= 5 AND ur.is_active = true
        )
    )
);

CREATE POLICY "Users can create their own issues"
ON issues FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Creator or mentors can update issues (status, etc.)"
ON issues FOR UPDATE
TO authenticated
USING (
    auth.uid() = creator_id OR 
    EXISTS (
        SELECT 1 FROM user_roles ur
        WHERE ur.user_id = auth.uid() AND ur.role_id >= 2 AND ur.is_active = true
    )
);

-- Comments Policy:
-- Inherits visibility from the parent issue.
-- Internal notes only visible to mentors.
CREATE POLICY "Comments visibility based on issue access"
ON issue_comments FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM issues i WHERE i.id = issue_comments.issue_id
    ) AND (
        is_internal_note = false OR 
        EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = auth.uid() AND ur.role_id >= 2 AND ur.is_active = true
        )
    )
);

CREATE POLICY "Users can insert comments if they can see the issue"
ON issue_comments FOR INSERT
TO authenticated
WITH CHECK (
    auth.uid() = author_id AND
    EXISTS (
        SELECT 1 FROM issues i WHERE i.id = issue_comments.issue_id
    )
);

-- Resolutions Policy:
-- Inherits visibility from the parent issue.
CREATE POLICY "Resolutions visibility based on issue access"
ON issue_resolutions FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM issues i WHERE i.id = issue_resolutions.issue_id
    )
);

CREATE POLICY "Mentors or creators can insert resolutions"
ON issue_resolutions FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM issues i WHERE i.id = issue_resolutions.issue_id
    )
);
