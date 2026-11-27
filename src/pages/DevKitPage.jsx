import React, { useState } from "react";
import {
  Bar,
  Button,
  Chips,
  Choice,
  Counter,
  Empty,
  Field,
  Fig,
  Lead,
  Loader,
  Modal,
  Row,
  SectionHead,
  Steps,
  TabsLine,
} from "../components/index.js";

/* Dev-only YPL League Almanac component catalog (?view=dev-kit).
   Excluded from production builds (App.jsx guards it with import.meta.env.DEV).
   Use this page at 390 and 1440 in dark, light, and high contrast before building a new screen. */
export default function DevKitPage() {
  const [tab, setTab] = useState("a");
  const [choice, setChoice] = useState("개인전");
  const [chip, setChip] = useState("전체");
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);

  return (
    <section className="ad-page">
      <h1 className="page-title">연감 부품</h1>
      <p className="read">개발 서버 전용 카탈로그입니다. 새 화면이나 기능을 만들 때 아래 공용 부품과 토큰을 그대로 가져다 씁니다.</p>

      <section className="ad-block">
        <SectionHead title="숫자와 카운터" />
        <div className="stack ad-counts">
          <Counter label="참가자" value="32" h={84} />
          <Counter label="남은 경기" value="4" h={84} />
          <Counter label="시즌" value="3" h={84} />
          <Counter label="진행 중" value="1" h={84} lamp />
        </div>
      </section>

      <section className="ad-block">
        <SectionHead title="줄과 막대" />
        <div className="stack opens">
          <Lead date="2026.11.27" title="대표 공지나 강조 항목" line="2px 강조선 아래에 서는 리드 줄입니다." lamp />
          <Row title="기본 항목 줄" line="보조 설명이 한 줄로 붙습니다." value={<span className="t12 dim">값</span>} onClick={() => setOpen(true)} />
          <Row className="inv" title="선택되거나 확정된 항목" line="inv 클래스로 강조합니다." value={<span className="t12">확정</span>} />
          <div className="pn">
            <span className="t12 dim">비율 막대 (62%)</span>
            <Bar value={62} />
          </div>
        </div>
      </section>

      <section className="ad-block">
        <SectionHead title="탭, 칩, 단계" />
        <TabsLine value={tab} onChange={setTab} options={[["a", "첫째 탭"], ["b", "둘째 탭"], ["c", "셋째 탭"]]} label="예시 탭" />
        <Chips value={chip} onChange={setChip} options={[["전체", "전체"], ["마스터", "마스터"], ["루키", "루키"]]} label="예시 필터" />
        <Steps labels={["신청", "대진표", "경기", "기록"]} at={2} />
      </section>

      <section className="ad-block">
        <SectionHead title="입력과 버튼" />
        <Field label="텍스트 입력">
          <input value={text} onChange={e => setText(e.target.value)} placeholder="값을 입력합니다." />
        </Field>
        <Choice name="devkit-choice" options={["개인전", "팀전"]} value={choice} onChange={setChoice} />
        <div className="modal-actions">
          <Button variant="link" onClick={() => setOpen(true)}>링크 액션</Button>
          <Button variant="second" onClick={() => setOpen(true)}>보조 액션</Button>
          <Button variant="main" icon="check" onClick={() => setOpen(true)}>주 액션</Button>
        </div>
      </section>

      <section className="ad-block">
        <SectionHead title="빈 상태와 로딩" />
        <Empty title="표시할 기록이 없습니다." desc="사실이 없을 때만 빈 상태를 둡니다." />
        <Loader />
      </section>

      {open && (
        <Modal title="공용 시트" hint="페이지 안의 대화창은 모두 Modal을 씁니다." onClose={() => setOpen(false)}>
          <Fig value="42" h={84} label="42" />
          <p className="read">확인 액션은 주 액션(main), 닫기는 보조 액션(second)으로 둡니다.</p>
          <div className="modal-actions">
            <Button variant="second" onClick={() => setOpen(false)}>닫기</Button>
            <Button variant="main" icon="check" onClick={() => setOpen(false)}>확인</Button>
          </div>
        </Modal>
      )}
    </section>
  );
}
