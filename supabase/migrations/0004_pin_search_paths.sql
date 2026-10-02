-- Supabase linter 0011: pin search_path on the remaining helpers.
alter function public._clamp(int) set search_path = public;
alter function public._rand_stat(int, int) set search_path = public;
alter function public._me() set search_path = public;
alter function public.horse_age_on(date, int, date) set search_path = public;
