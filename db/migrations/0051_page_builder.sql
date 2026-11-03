-- The tip page as a document (page builder phase 1; paid feature "pageBuilder"). Safe to re-run.
--
-- users.page_draft     — the page the owner is working on, as one JSON document: an ordered list
--                        of blocks plus a small theme (src/lib/page-doc). Nothing writes it yet;
--                        the editor of a later phase does.
-- users.page_published — the page fans see, while the creator's "Custom tip page" switch is on.
--                        Null means the normal page (the owner's own page for the owner).
-- users.page_previous  — the page published before this one, one step back, so "Restore previous
--                        version" is one click. Publishing moves published to previous; restoring
--                        swaps the two; "Reset to normal page" empties all three.
--
-- The code reads every stored document through one parser (src/lib/page-doc/parse.ts) when the
-- page is drawn: anything invalid is dropped or replaced on its own, a missing or hidden pay block
-- is put back, and a value that is not a page at all gives the normal page. So a bad value can
-- never break a tip page.
--
-- Run BEFORE deploying the matching code (the tip page still loads without it, as the normal page).

alter table users add column if not exists page_draft jsonb;
alter table users add column if not exists page_published jsonb;
alter table users add column if not exists page_previous jsonb;
