BEGIN;

-- Canonicalize duplicate active memberships by keeping the most recent active row per user.
WITH ranked_active AS (
  SELECT
    id,
    user_id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id
      ORDER BY
        accepted_at DESC NULLS LAST,
        updated_at DESC NULLS LAST,
        created_at DESC NULLS LAST,
        id DESC
    ) AS rn
  FROM public.organization_memberships
  WHERE COALESCE(is_active, false) = true
), to_deactivate AS (
  SELECT id
  FROM ranked_active
  WHERE rn > 1
)
UPDATE public.organization_memberships m
SET
  is_active = false,
  status = CASE
    WHEN LOWER(COALESCE(m.status, '')) = 'active' THEN 'inactive'
    ELSE COALESCE(m.status, 'inactive')
  END,
  updated_at = timezone('utc', now())
FROM to_deactivate d
WHERE m.id = d.id;

-- Hard DB invariant: only one active membership row per user.
CREATE UNIQUE INDEX IF NOT EXISTS organization_memberships_single_active_user_idx
  ON public.organization_memberships (user_id)
  WHERE COALESCE(is_active, false) = true;

COMMIT;
