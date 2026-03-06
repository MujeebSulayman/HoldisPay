-- Ensure user_payment_methods.user_id references public.users(id) so inserts
-- using the app's user id (from JWT / public.users) succeed.
ALTER TABLE user_payment_methods
  DROP CONSTRAINT IF EXISTS user_payment_methods_user_id_fkey;

ALTER TABLE user_payment_methods
  ADD CONSTRAINT user_payment_methods_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id);
