-- 012_creator_security_hardening.sql
-- Prevent duplicate payout ledger rows for the same creator/campaign pair.

delete from user_earnings older
using user_earnings newer
where older.user_google_sub = newer.user_google_sub
  and older.campaign_id is not distinct from newer.campaign_id
  and older.ctid < newer.ctid;

create unique index if not exists user_earnings_user_campaign_unique
  on user_earnings (user_google_sub, campaign_id);
