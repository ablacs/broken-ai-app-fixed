-- The read policy compared the user's id with the note's id, which never
-- match, so every query returned zero rows. Compare with the owner instead.

drop policy "Users read their own notes" on public.notes;

create policy "Users read their own notes"
  on public.notes for select
  using (auth.uid() = user_id);
