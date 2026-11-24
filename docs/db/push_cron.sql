-- 알림 정리를 DB가 1분마다 부른다 (docs/PUSH.md "보내는 길", 2026-11-24).
-- 15분마다여야 할 GitHub 예약 실행(push-sweep.yml)이 실제로는 6~8시간에 한 번 돌았다(gh run list, 2026-11-18..24). 그래서 게시판 새 글,
-- 댓글, 도전의 탑, 라운드 시작 알림이 몇 시간 늦거나 하루가 지나 버려졌다(push_take는 하루 지난 줄을 보내지 않는다).
-- pg_net으로 notify-announcement { sweep } 을 부른다. 공개 키(사이트가 쓰는 것)만 쓰고, 무엇을 누구에게 보낼지는 push_take가 정해
-- 한 번만 꺼내 주므로 GitHub 실행과 겹쳐도 같은 알림이 두 번 가지 않는다. 여러 번 실행해도 된다.
-- 확인: select jobname, schedule from cron.job where jobname = 'push-sweep';
--       몇 분 뒤 select status_code, created from net._http_response order by id desc limit 3;  (200)
create extension if not exists pg_net;

do $$
begin
  perform cron.unschedule(jobid) from cron.job where jobname = 'push-sweep';
  perform cron.schedule('push-sweep', '* * * * *', $job$
    select net.http_post(
      url := 'https://rqffrogcverfjqzjasax.supabase.co/functions/v1/notify-announcement',
      headers := '{"apikey": "sb_publishable_HDboN3v8Jl5CiS3yq1GxhQ_lLatSneH", "Content-Type": "application/json"}'::jsonb,
      body := '{"sweep": true}'::jsonb,
      timeout_milliseconds := 30000)
  $job$);
end $$;
