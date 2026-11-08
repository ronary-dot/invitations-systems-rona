-- Personal invite link /i/[token].
--
-- inv_invite returns the event plus what we already know about the invitee
-- (and their RSVP, if any) so the form opens pre-filled. It works even when
-- the general link is closed.
--
-- inv_mark_invite_opened is called from the browser after the page loads, not
-- while rendering, so link previews (WhatsApp, email scanners) do not count
-- as "opened".

create or replace function public.inv_invite(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'event', public.inv_event_public_json(e),
    'invitee', jsonb_build_object(
      'full_name', i.full_name,
      'phone', i.phone,
      'email', i.email,
      'expected_guests', i.expected_guests
    ),
    'registration', (
      select jsonb_build_object(
        'full_name', r.full_name,
        'phone', r.phone,
        'email', r.email,
        'attending', r.attending,
        'guest_count', r.guest_count,
        'guest_names', r.guest_names,
        'notes', r.notes
      )
      from public.inv_registrations r
      where r.invitee_id = i.id
      order by r.updated_at desc
      limit 1
    )
  )
  from public.inv_invitees i
  join public.inv_events e on e.id = i.event_id
  where i.token = p_token and e.is_active;
$$;

create or replace function public.inv_mark_invite_opened(p_token text)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  update public.inv_invitees
    set opened_at = coalesce(opened_at, now()),
        status = case when status in ('pending', 'sent') then 'opened'::public.inv_invitee_status else status end
  where token = p_token;
$$;

revoke all on function public.inv_invite(text) from public;
grant execute on function public.inv_invite(text) to anon, authenticated;
revoke all on function public.inv_mark_invite_opened(text) from public;
grant execute on function public.inv_mark_invite_opened(text) to anon, authenticated;
