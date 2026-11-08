-- Storage delete/update first select the object, so staff need a select
-- policy to manage media. Anonymous visitors still cannot list the bucket.
create policy "inv-event-media: staff select"
  on storage.objects for select to authenticated
  using (bucket_id = 'inv-event-media' and public.inv_is_staff());
