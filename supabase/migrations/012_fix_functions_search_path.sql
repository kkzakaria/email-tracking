-- Fix search_path for functions to resolve security warnings
-- Migration: 012_fix_functions_search_path.sql
-- Note: Only adds SET search_path = 'public' to existing functions without modifying signatures

-- Update search_path for detect_email_replies function
ALTER FUNCTION public.detect_email_replies() SET search_path = 'public';

-- Update search_path for detect_sent_email function  
ALTER FUNCTION public.detect_sent_email() SET search_path = 'public';

-- Update search_path for log_sent_message function
ALTER FUNCTION public.log_sent_message(uuid, text, text, text) SET search_path = 'public';

-- Update search_path for check_renewal_job_status function
ALTER FUNCTION public.check_renewal_job_status() SET search_path = 'public';

-- Update search_path for refresh_expired_microsoft_tokens function
ALTER FUNCTION public.refresh_expired_microsoft_tokens() SET search_path = 'public';

-- Update search_path for test_token_refresh function
ALTER FUNCTION public.test_token_refresh() SET search_path = 'public';

-- Update search_path for cleanup_old_cron_logs function
ALTER FUNCTION public.cleanup_old_cron_logs() SET search_path = 'public';

-- Update search_path for test_cron_logs_rls function
ALTER FUNCTION public.test_cron_logs_rls() SET search_path = 'public';