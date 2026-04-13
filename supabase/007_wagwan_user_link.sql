-- Link wagwan-ai profiles to wagwan main platform users.
-- wagwan_user_id is the UUID from wagwan's users table.
-- Nullable because existing profiles were created before this link existed.

alter table user_profiles
  add column if not exists wagwan_user_id text;

-- Unique index: one wagwan user maps to one wagwan-ai profile
create unique index if not exists user_profiles_wagwan_user_id_idx
  on user_profiles (wagwan_user_id)
  where wagwan_user_id is not null;
