-- Create waitlist table
CREATE TABLE public.waitlist (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

-- Create policy to allow anyone to insert (for waitlist signup)
CREATE POLICY "Anyone can insert waitlist entries" ON public.waitlist
    FOR INSERT WITH CHECK (true);

-- Create policy to prevent reading (only admins should see the list)
CREATE POLICY "No one can read waitlist entries" ON public.waitlist
    FOR SELECT USING (false);

-- Create index on email for better performance
CREATE INDEX waitlist_email_idx ON public.waitlist(email);

-- Create index on created_at for sorting
CREATE INDEX waitlist_created_at_idx ON public.waitlist(created_at);
