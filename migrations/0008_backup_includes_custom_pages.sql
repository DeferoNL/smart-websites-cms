CREATE OR REPLACE FUNCTION public.create_site_backup() RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE new_id uuid; BEGIN IF NOT public.can_edit(auth.uid()) THEN RAISE EXCEPTION 'Geen rechten'; END IF; INSERT INTO site_backups(created_by,created_by_email,data) VALUES(auth.uid(),(SELECT email FROM auth.users WHERE id=auth.uid()),jsonb_build_object('page_content',coalesce((SELECT jsonb_agg(to_jsonb(c)) FROM page_content c),'[]'::jsonb),'page_seo',coalesce((SELECT jsonb_agg(to_jsonb(s)) FROM page_seo s),'[]'::jsonb),'page_settings',coalesce((SELECT jsonb_agg(to_jsonb(p)) FROM page_settings p),'[]'::jsonb),'custom_pages',coalesce((SELECT jsonb_agg(to_jsonb(cp)) FROM custom_pages cp),'[]'::jsonb))) RETURNING id INTO new_id; DELETE FROM site_backups WHERE id IN(SELECT id FROM site_backups ORDER BY created_at DESC OFFSET 3); RETURN new_id; END $$;

CREATE OR REPLACE FUNCTION public.restore_site_backup(_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE b jsonb; BEGIN IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Geen rechten'; END IF; SELECT data INTO b FROM site_backups WHERE id=_id; IF b IS NULL THEN RAISE EXCEPTION 'Back-up niet gevonden'; END IF;
IF b ? 'custom_pages' THEN
  DELETE FROM page_content WHERE path IN (SELECT path FROM custom_pages);
  DELETE FROM page_seo WHERE path IN (SELECT path FROM custom_pages);
  DELETE FROM page_settings WHERE path IN (SELECT path FROM custom_pages);
  DELETE FROM custom_pages WHERE path IS NOT NULL;
  INSERT INTO custom_pages SELECT * FROM jsonb_populate_recordset(NULL::public.custom_pages,b->'custom_pages');
END IF;
DELETE FROM page_content WHERE path IS NOT NULL; DELETE FROM page_seo WHERE path IS NOT NULL; DELETE FROM page_settings WHERE path IS NOT NULL;
INSERT INTO page_content SELECT * FROM jsonb_populate_recordset(NULL::public.page_content,b->'page_content'); INSERT INTO page_seo SELECT * FROM jsonb_populate_recordset(NULL::public.page_seo,b->'page_seo'); INSERT INTO page_settings SELECT * FROM jsonb_populate_recordset(NULL::public.page_settings,b->'page_settings'); END $$;

REVOKE EXECUTE ON FUNCTION public.create_site_backup(), public.restore_site_backup(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_site_backup(), public.restore_site_backup(uuid) TO authenticated;