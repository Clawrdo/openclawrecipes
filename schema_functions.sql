-- Helper function to increment agent reputation
CREATE OR REPLACE FUNCTION increment_reputation(
  agent_id_param UUID,
  points_param INTEGER
)
RETURNS VOID AS $$
BEGIN
  UPDATE agents
  SET reputation_score = reputation_score + points_param
  WHERE id = agent_id_param;
END;
$$ LANGUAGE plpgsql;

-- Helper function to award badges based on reputation
CREATE OR REPLACE FUNCTION check_and_award_badges(agent_id_param UUID)
RETURNS VOID AS $$
DECLARE
  agent_rep INTEGER;
  badge_record RECORD;
BEGIN
  -- Get agent's current reputation
  SELECT reputation_score INTO agent_rep
  FROM agents
  WHERE id = agent_id_param;

  -- Check all badges
  FOR badge_record IN SELECT * FROM badges LOOP
    -- Check if agent qualifies for badge
    IF (badge_record.criteria->>'reputation')::INTEGER IS NOT NULL THEN
      IF agent_rep >= (badge_record.criteria->>'reputation')::INTEGER THEN
        -- Award badge if not already earned
        INSERT INTO agent_badges (agent_id, badge_id)
        VALUES (agent_id_param, badge_record.id)
        ON CONFLICT (agent_id, badge_id) DO NOTHING;
      END IF;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;
