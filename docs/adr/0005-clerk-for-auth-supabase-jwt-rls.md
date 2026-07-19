# Clerk for authentication, integrated with Supabase via JWT for RLS

Authentication uses Clerk rather than Supabase Auth, even though Supabase is the database. Clerk issues a JWT that Supabase trusts; Row-Level Security policies scope every row to the Clerk user ID carried in the token. The app is single-user in v1 (one account, the owner); RLS means multi-user or shareable-with-partner is a policy change rather than an app change. The agent operates under the owner's session.

Rejected alternative: Supabase Auth — would remove the Clerk↔Supabase JWT plumbing, but Clerk's managed auth UX and component ecosystem were preferred. Trade-off accepted: a thin integration layer (JWT template + RLS against Clerk user ID) in exchange for Clerk's out-of-the-box experience.
