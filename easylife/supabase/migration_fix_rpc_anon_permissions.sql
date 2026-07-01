-- Sécurité : révoquer l'accès anon sur les fonctions RPC sensibles
-- Ces fonctions vérifient auth.uid() en interne mais ne doivent pas
-- être accessibles aux utilisateurs non authentifiés via /rest/v1/rpc/

revoke execute on function public.accept_family_invite(text) from anon;
revoke execute on function public.create_family(text) from anon;
revoke execute on function public.create_family_invite(text) from anon;
revoke execute on function public.user_family_id() from anon;
revoke execute on function public.is_family_member(uuid) from anon;
revoke execute on function public.revoke_family_invite(uuid) from anon;
revoke execute on function public.get_family_members() from anon;
revoke execute on function public.get_family_pending_invites() from anon;
