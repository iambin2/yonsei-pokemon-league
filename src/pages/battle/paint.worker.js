/* 무대가 한 번 그려 두고 쓰는 그림을 페이지 밖에서 그린다(stageFx prewarm): 파티클의 아틀라스(atlas.js)와 몬스터볼의 24프레임(balls.js).
   페이지의 걸음과 같은 코드라 같은 값이 나온다. 그릴 수 없으면 null을 보내고, 페이지가 걸음으로 그린다. */
import { paintAtlasNow } from "./atlas.js";
import { ballFrames } from "./balls.js";

try {
  const atlas = paintAtlasNow(), gen = ballFrames();
  let r;
  do r = gen.next(); while (!r.done);
  const balls = r.value;
  postMessage({ atlas, balls }, [atlas.out.buffer, atlas.nrm.buffer, atlas.noise.buffer, ...balls.map(px => px.buffer)]);
} catch {
  postMessage(null);
}
