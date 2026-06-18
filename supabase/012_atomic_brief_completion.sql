-- 012_atomic_brief_completion.sql
-- Complete a creator brief and credit the pending earning in one transaction.
-- The app calls this RPC so a failed ledger insert cannot leave a completed
-- brief without the corresponding payout row.

create or replace function complete_brief_with_pending_earning(
  p_user_google_sub text,
  p_campaign_id uuid,
  p_ig_post_url text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_brief_id bigint;
  v_reward numeric(12, 2);
  v_title text;
begin
  select id
    into v_brief_id
  from brief_responses
  where campaign_id = p_campaign_id
    and user_google_sub = p_user_google_sub
    and status in ('accepted', 'live')
  for update;

  if v_brief_id is null then
    return false;
  end if;

  select reward_inr, title
    into v_reward, v_title
  from campaigns
  where id = p_campaign_id;

  if not found then
    raise exception 'campaign % not found', p_campaign_id
      using errcode = 'foreign_key_violation';
  end if;

  if coalesce(v_reward, 0) > 0 then
    insert into user_earnings (
      user_google_sub,
      campaign_id,
      amount_inr,
      status,
      note
    )
    select
      p_user_google_sub,
      p_campaign_id,
      v_reward,
      'pending',
      'Campaign completed - pending settlement' ||
        case when v_title is not null and v_title <> '' then ' (' || v_title || ')' else '' end
    where not exists (
      select 1
      from user_earnings
      where user_google_sub = p_user_google_sub
        and campaign_id = p_campaign_id
    );
  end if;

  update brief_responses
  set
    status = 'completed',
    ig_post_url = p_ig_post_url,
    completed_at = now(),
    updated_at = now()
  where id = v_brief_id;

  return true;
end;
$$;

revoke execute on function complete_brief_with_pending_earning(text, uuid, text)
  from public, anon, authenticated;
grant execute on function complete_brief_with_pending_earning(text, uuid, text)
  to service_role;
