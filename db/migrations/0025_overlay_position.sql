-- Where the alert card sits on the OBS screen. Safe to re-run.
--
-- users.overlay_position — one of the nine spots on a 3 x 3 grid, vertical first:
--                          top-left ... middle-center ... bottom-right. Default is
--                          the old placement, bottom-center.

alter table users
  add column if not exists overlay_position text not null default 'bottom-center'
    check (overlay_position in (
      'top-left', 'top-center', 'top-right',
      'middle-left', 'middle-center', 'middle-right',
      'bottom-left', 'bottom-center', 'bottom-right'
    ));
