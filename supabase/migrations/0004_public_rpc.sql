-- Public access goes through SECURITY DEFINER functions instead of table
-- policies. The anon key can read an active event's public fields and submit
-- an RSVP with validated input. Everything else stays staff-only.
--
-- Two entry points share the same RSVP logic:
--   * general link /e/[slug]  -> p_slug, only while allow_public_link is on
--   * personal link /i/[token] -> p_token, works even when the general link is closed

create or replace function public.inv_event_public_json(e public.inv_events)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', e.id,
    'slug', e.slug,
    'title', e.title,
    'event_type', e.event_type,
    'description', e.description,
    'date_time', e.date_time,
    'venue_name', e.venue_name,
    'address', e.address,
    'lat', e.lat,
    'lng', e.lng,
    'template_id', e.template_id,
    'media_url', e.media_url,
    'primary_color', e.primary_color,
    'gift_link_url', e.gift_link_url,
    'rsvp_deadline', e.rsvp_deadline,
    'max_guests', e.max_guests,
    'allow_public_link', e.allow_public_link,
    'updated_at', e.updated_at,
    'attending_guests', coalesce((
      select sum(r.guest_count) from public.inv_registrations r
      where r.event_id = e.id and r.attending
    ), 0)
  );
$$;

revoke all on function public.inv_event_public_json(public.inv_events) from public, anon, authenticated;

-- ---------- public event (general link) ----------
create or replace function public.inv_public_event(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select public.inv_event_public_json(e)
  from public.inv_events e
  where e.slug = p_slug and e.is_active and e.allow_public_link;
$$;

-- ---------- RSVP ----------
create or replace function public.inv_register(
  p_slug text,
  p_token text,
  p_full_name text,
  p_phone text,
  p_email text,
  p_attending boolean,
  p_guest_count integer,
  p_guest_names jsonb,
  p_notes text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.inv_events%rowtype;
  v_invitee_id uuid;
  v_existing public.inv_registrations%rowtype;
  v_taken integer;
  v_count integer;
  v_names jsonb;
  v_id uuid;
  v_created boolean;
begin
  if p_token is not null then
    select i.id into v_invitee_id from public.inv_invitees i where i.token = p_token;
    select e.* into v_event from public.inv_events e
      join public.inv_invitees i on i.event_id = e.id
      where i.id = v_invitee_id and e.is_active;
  else
    select * into v_event from public.inv_events
      where slug = p_slug and is_active and allow_public_link;
  end if;
  if v_event.id is null then
    raise exception 'not_found' using errcode = 'P0001';
  end if;

  if now() > v_event.date_time
     or (v_event.rsvp_deadline is not null and now() > v_event.rsvp_deadline) then
    raise exception 'closed' using errcode = 'P0001';
  end if;

  if p_attending then
    if p_guest_count < 1 or p_guest_count > 50
       or jsonb_typeof(p_guest_names) <> 'array'
       or jsonb_array_length(p_guest_names) <> p_guest_count then
      raise exception 'invalid' using errcode = 'P0001';
    end if;
    v_count := p_guest_count;
    v_names := p_guest_names;
  else
    v_count := 0;
    v_names := '[]'::jsonb;
  end if;

  -- From the general link, connect the RSVP to a guest-list entry with the same phone.
  if v_invitee_id is null then
    select id into v_invitee_id from public.inv_invitees
      where event_id = v_event.id and phone = p_phone;
  end if;

  select * into v_existing from public.inv_registrations
    where event_id = v_event.id
      and ((v_invitee_id is not null and invitee_id = v_invitee_id) or phone = p_phone)
    order by (invitee_id is not distinct from v_invitee_id) desc
    limit 1;

  if p_attending and v_event.max_guests is not null then
    select coalesce(sum(guest_count), 0) into v_taken
    from public.inv_registrations
    where event_id = v_event.id and attending
      and (v_existing.id is null or id <> v_existing.id);
    if v_taken + v_count > v_event.max_guests then
      raise exception 'full' using errcode = 'P0001';
    end if;
  end if;

  if v_existing.id is null then
    insert into public.inv_registrations
      (event_id, invitee_id, full_name, phone, email, attending, guest_count, guest_names, notes, source)
    values
      (v_event.id, v_invitee_id, p_full_name, p_phone, p_email, p_attending, v_count, v_names, p_notes,
       case when p_token is not null then 'invite_link' else 'public_link' end::public.inv_registration_source)
    returning id into v_id;
    v_created := true;
  else
    update public.inv_registrations
      set invitee_id = coalesce(v_invitee_id, invitee_id),
          full_name = p_full_name,
          phone = p_phone,
          email = p_email,
          attending = p_attending,
          guest_count = v_count,
          guest_names = v_names,
          notes = p_notes
    where id = v_existing.id
    returning id into v_id;
    v_created := false;
  end if;

  if v_invitee_id is not null then
    update public.inv_invitees
      set status = case when p_attending then 'confirmed' else 'declined' end::public.inv_invitee_status,
          responded_at = now()
    where id = v_invitee_id;
  end if;

  return jsonb_build_object('id', v_id, 'created', v_created);
end;
$$;

revoke all on function public.inv_public_event(text) from public;
grant execute on function public.inv_public_event(text) to anon, authenticated;

revoke all on function public.inv_register(text, text, text, text, text, boolean, integer, jsonb, text) from public;
grant execute on function public.inv_register(text, text, text, text, text, boolean, integer, jsonb, text) to anon, authenticated;
