-- Fix RLS policies for user_roles to allow users to see roles properly

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;

-- Allow authenticated users to view all user roles (needed for UI display)
CREATE POLICY "Authenticated users can view all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (true);

-- Keep admin-only policies for modifications
-- (Admins can insert roles, Admins can update roles, Admins can delete roles already exist)