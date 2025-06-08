CREATE TABLE public.imam_muezzin_schedules (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  day_of_week text NOT NULL,
  prayer_name text NOT NULL,
  imam_name text NOT NULL,
  muezzin_name text,
  display_order integer DEFAULT 0 NOT NULL
);

ALTER TABLE public.imam_muezzin_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users" ON public.imam_muezzin_schedules FOR SELECT USING (true);
CREATE POLICY "Enable insert for authenticated users only" ON public.imam_muezzin_schedules FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Enable update for authenticated users only" ON public.imam_muezzin_schedules FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Enable delete for authenticated users only" ON public.imam_muezzin_schedules FOR DELETE USING (auth.role() = 'authenticated');