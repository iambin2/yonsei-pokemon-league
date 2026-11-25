import { supa as client } from "../storage.js";
import { attachConfirmedTeamIdentities, buildTeamMemberCandidates, getConfirmedTeamMemberIdentities } from "./bracketTeamParticipants.js";
import { findPlayerByName, playerNameKey } from "./teamBuilderCore.js";
import { db, fail, getEvent, loadPlayerNames } from "./normalizedDb.js";

function newDatabaseId() {
  if (!globalThis.crypto?.randomUUID) {
    throw new Error("이 브라우저에서는 저장할 수 없습니다. 최신 Chrome이나 Safari에서 다시 열어 주세요.");
  }
  return globalThis.crypto.randomUUID();
}

async function createRecordPlayer(displayName, playerId = newDatabaseId()) {
  const name = String(displayName || "").trim();
  const { data: created, error: createError } = await db()
    .from("players")
    .insert({
      id: playerId,
      display_name: name,
      status: "active",
    })
    .select("id, display_name")
    .single();

  if (createError) fail(createError, `${name}의 신규 선수를 생성하지 못했습니다.`);
  return created;
}

function actualIndividualParticipants(participants = [], emptyMessage) {
  const actual = (participants || [])
    .filter(participant => !Array.isArray(participant?.members))
    .map(participant => ({
      ...participant,
      name: String(participant?.name || "").trim(),
    }))
    .filter(participant => participant.name);

  if (!actual.length) throw new Error(emptyMessage);

  const participantIds = new Set();
  for (const participant of actual) {
    if (!participant.id) throw new Error(`'${participant.name}' 참가자의 대진표 ID가 없습니다.`);
    if (participantIds.has(participant.id)) {
      throw new Error(`'${participant.name}' 참가자가 대진표에 중복되어 있습니다.`);
    }
    participantIds.add(participant.id);
  }

  return actual;
}

function actualTeamParticipants(participants = [], emptyMessage) {
  const actual = (participants || [])
    .filter(participant => Array.isArray(participant?.members))
    .map(participant => ({
      ...participant,
      name: String(participant?.name || "").trim(),
    }))
    .filter(participant => participant.name);

  if (!actual.length) throw new Error(emptyMessage);

  const participantIds = new Set();
  for (const participant of actual) {
    if (!participant.id) throw new Error(`'${participant.name}' 팀의 대진표 ID가 없습니다.`);
    if (participantIds.has(participant.id)) {
      throw new Error(`'${participant.name}' 팀이 대진표에 중복되어 있습니다.`);
    }
    participantIds.add(participant.id);
  }

  return actual;
}

async function preflightEventParticipantIdentities(
  eventId,
  participants,
  { requireEmptyEntries = false, requireTeamEvent = false } = {}
) {
  const actualParticipants = actualIndividualParticipants(
    participants,
    "확정할 실제 참가자가 없습니다."
  );

  const event = await getEvent(eventId);
  if (!event) throw new Error("연결된 대회를 찾을 수 없습니다.");
  if (requireTeamEvent && !event.is_team_event) {
    throw new Error("개인전 대회에는 팀 참가자를 확정할 수 없습니다.");
  }
  if (!requireTeamEvent && event.is_team_event) {
    throw new Error("팀전 대회에는 개인 참가자를 확정할 수 없습니다.");
  }
  if (!["open", "running"].includes(event.status) || event.record_applied_at) {
    throw new Error("현재 참가자를 확정할 수 없는 대회입니다.");
  }

  const { data: registrations, error: registrationError } = await db()
    .from("event_registrations")
    .select("id, event_id, player_id, registration_name, registration_source")
    .eq("event_id", eventId);

  if (registrationError) fail(registrationError, "대회 참가 신청 정보를 확인하지 못했습니다.");

  if (requireEmptyEntries) {
    const { data: existingEntries, error: entryError } = await db()
      .from("entries")
      .select("id")
      .eq("event_id", eventId)
      .limit(1);

    if (entryError) fail(entryError, "기존 참가 확정 정보를 확인하지 못했습니다.");
    if (existingEntries?.length) {
      throw new Error("이 대회에는 이미 확정된 출전 정보가 있습니다. 대회당 대진표는 하나만 생성할 수 있습니다.");
    }
  }

  const registrationRows = registrations || [];
  const registrationById = new Map(registrationRows.map(row => [row.id, row]));
  const claimedRegistrationIds = new Set();
  const plans = actualParticipants.map(participant => {
    let registration = null;

    if (participant.registrationId) {
      registration = registrationById.get(participant.registrationId) || null;
      if (!registration) {
        throw new Error(`${participant.name}의 참가 신청이 이 대회에 속하지 않거나 존재하지 않습니다.`);
      }
    } else {
      const matches = registrationRows.filter(row => playerNameKey(row.registration_name) === playerNameKey(participant.name));
      if (matches.length > 1) {
        throw new Error(`'${participant.name}' 이름의 참가 신청이 중복되어 있습니다. 참가 확정 전에 확인이 필요합니다.`);
      }
      registration = matches[0] || null;
    }

    if (registration && claimedRegistrationIds.has(registration.id)) {
      throw new Error(`'${participant.name}' 참가 신청이 대진표에 중복되어 있습니다.`);
    }
    if (registration) claimedRegistrationIds.add(registration.id);

    return {
      participant,
      registration,
      identityName: String(registration?.registration_name || participant.name).trim(),
      playerId: registration?.player_id || null,
    };
  });

  const players = plans.some(plan => !plan.playerId) ? await loadPlayerNames() : [];

  for (const plan of plans) {
    if (plan.playerId) continue;
    const player = findPlayerByName(players, plan.identityName);
    if (player && player.display_name !== plan.identityName) {
      // 신청 이름은 바꾸지 않는다. 운영진이 표기를 맞춘 뒤 다시 확정한다.
      if (plan.registration) {
        throw new Error(`'${plan.identityName}' 참가 신청이 기존 선수 '${player.display_name}'과 표기만 다릅니다. 신청 이름을 맞춘 뒤 다시 확정해 주세요.`);
      }
      plan.identityName = player.display_name;
    }
    plan.playerId = player?.id || null;
  }

  const claimedIdentity = new Map();
  for (const plan of plans) {
    const key = plan.playerId ? `player:${plan.playerId}` : `new:${playerNameKey(plan.identityName)}`;
    if (claimedIdentity.has(key)) {
      throw new Error(`'${plan.identityName}' 참가자가 대진표에 중복되어 있습니다. 식별 정보를 자동 확정할 수 없습니다.`);
    }
    claimedIdentity.set(key, plan);

    if (plan.playerId) {
      const conflictingRegistration = registrationRows.find(row =>
        row.player_id === plan.playerId && row.id !== plan.registration?.id
      );
      if (conflictingRegistration) {
        throw new Error(`'${plan.identityName}' 선수가 이 대회의 다른 참가 신청에 이미 연결되어 있습니다.`);
      }
    }
  }

  return { event, actualParticipants, plans };
}

function rollbackFailure(originalError, rollbackErrors) {
  const rollbackSummary = rollbackErrors.map(error => error.message).join(" / ");
  const combined = new Error(
    `${originalError?.message || "참가자를 확정하지 못했습니다."} (자동으로 되돌리지도 못했습니다. ${rollbackSummary})`
  );
  combined.code = "YPL_PARTICIPANT_CONFIRMATION_ROLLBACK_FAILED";
  combined.cause = originalError;
  combined.rollbackErrors = rollbackErrors;
  return combined;
}

export async function rollbackEventParticipantIdentityChanges(
  eventId,
  identityChanges = [],
  { requireUnappliedEvent = false, requireExactRows = false } = {}
) {
  if (!eventId) return null;

  if (requireUnappliedEvent) {
    const event = await getEvent(eventId);
    if (!event) throw new Error("참가 확정을 되돌릴 대회를 찾을 수 없습니다.");
    if (event.record_applied_at || event.status === "completed") {
      throw new Error("기록이 반영된 대회의 참가 확정은 대진표 삭제로 되돌릴 수 없습니다.");
    }
  }

  const changes = Array.isArray(identityChanges) ? [...identityChanges].reverse() : [];
  const rollbackErrors = [];
  const remember = (error, fallback) => {
    if (!error) return;
    const next = new Error(error.message || fallback);
    next.code = error.code || "YPL_DB_ERROR";
    rollbackErrors.push(next);
  };

  for (const change of changes) {
    if (!change?.entryParticipantId) continue;
    const { data, error } = await db()
      .from("entry_participants")
      .delete()
      .eq("id", change.entryParticipantId)
      .eq("event_id", eventId)
      .select("id");
    remember(error, `${change.name || "참가자"}의 출전 선수를 정리하지 못했습니다.`);
    if (requireExactRows && !error && (data || []).length !== 1) {
      remember(new Error(`${change.name || "참가자"}의 출전 선수가 예상한 소속과 일치하지 않습니다.`), "출전 선수 소속을 확인하지 못했습니다.");
    }
  }

  for (const change of changes) {
    if (!change?.entryWasCreated || !change.entryId) continue;
    const { data, error } = await db()
      .from("entries")
      .delete()
      .eq("id", change.entryId)
      .eq("event_id", eventId)
      .select("id");
    remember(error, `${change.name || "참가자"}의 출전 정보를 정리하지 못했습니다.`);
    if (requireExactRows && !error && (data || []).length !== 1) {
      remember(new Error(`${change.name || "참가자"}의 출전 정보가 예상한 소속과 일치하지 않습니다.`), "출전 정보 소속을 확인하지 못했습니다.");
    }
  }

  for (const change of changes) {
    if (!change?.registrationId) continue;

    if (change.registrationWasCreated) {
      const { data, error } = await db()
        .from("event_registrations")
        .delete()
        .eq("id", change.registrationId)
        .eq("event_id", eventId)
        .select("id");
      remember(error, `${change.name || "참가자"}의 신규 참가 등록을 정리하지 못했습니다.`);
      if (requireExactRows && !error && (data || []).length !== 1) {
        remember(new Error(`${change.name || "참가자"}의 신규 참가 신청이 예상한 소속과 일치하지 않습니다.`), "참가 신청 소속을 확인하지 못했습니다.");
      }
      continue;
    }

    if (change.registrationPlayerWasLinked && change.playerId) {
      const { error } = await db()
        .from("event_registrations")
        .update({
          player_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", change.registrationId)
        .eq("event_id", eventId)
        .eq("player_id", change.playerId);
      remember(error, `${change.name || "참가자"}의 선수 연결을 정리하지 못했습니다.`);
    }
  }

  const createdPlayerIds = [...new Set(
    changes
      .filter(change => change?.playerWasCreated && change?.playerId)
      .map(change => change.playerId)
  )];

  for (const playerId of createdPlayerIds) {
    const { error } = await db()
      .from("players")
      .delete()
      .eq("id", playerId);

    if (error && String(error.code || "") !== "23503") {
      remember(error, "참가 확정 과정에서 생성된 선수를 정리하지 못했습니다.");
    }
  }

  if (rollbackErrors.length) {
    const error = new Error(rollbackErrors.map(row => row.message).join(" / "));
    error.code = "YPL_PARTICIPANT_CONFIRMATION_ROLLBACK_FAILED";
    error.rollbackErrors = rollbackErrors;
    throw error;
  }

  return null;
}

async function writeEventParticipantIdentities(eventId, plans, { createEntries = false } = {}) {
  const resolved = [];

  try {
    for (const plan of plans) {
      const { participant, registration, identityName } = plan;
      const playerWasCreated = !plan.playerId;
      const playerId = plan.playerId || newDatabaseId();
      const resolvedParticipant = {
        ...participant,
        registrationId: registration?.id || null,
        playerId,
        playerWasCreated,
        registrationWasCreated: false,
        registrationPlayerWasLinked: false,
        entryId: null,
        entryWasCreated: false,
        entryParticipantId: null,
      };
      // 생성 ID를 client에서 먼저 정해 응답이 유실되어도 rollback 대상을 안다.
      resolved.push(resolvedParticipant);

      if (playerWasCreated) await createRecordPlayer(identityName, playerId);

      if (registration?.player_id) {
        Object.assign(resolvedParticipant, {
          playerId: registration.player_id,
          playerWasCreated: false,
        });
      } else if (registration) {
        resolvedParticipant.registrationPlayerWasLinked = true;
        const { data: updated, error } = await db()
          .from("event_registrations")
          .update({
            player_id: playerId,
            updated_at: new Date().toISOString(),
          })
          .eq("id", registration.id)
          .eq("event_id", eventId)
          .is("player_id", null)
          .select("id, player_id")
          .single();

        if (error) fail(error, `${identityName}의 선수 연결을 저장하지 못했습니다.`);
        Object.assign(resolvedParticipant, {
          registrationId: updated.id,
          playerId: updated.player_id,
        });
      } else {
        const now = new Date().toISOString();
        const registrationId = newDatabaseId();
        Object.assign(resolvedParticipant, {
          registrationId,
          registrationWasCreated: true,
        });
        const { data: createdRegistration, error } = await db()
          .from("event_registrations")
          .insert({
            id: registrationId,
            event_id: eventId,
            player_id: playerId,
            registration_name: identityName,
            registration_data: {},
            registration_source: "manual",
            registered_at: now,
            updated_at: now,
          })
          .select("id, player_id")
          .single();

        if (error) fail(error, `${identityName}의 참가자 등록을 생성하지 못했습니다.`);
        Object.assign(resolvedParticipant, {
          registrationId: createdRegistration.id,
          playerId: createdRegistration.player_id,
        });
      }

      if (createEntries) {
        const entryId = newDatabaseId();
        Object.assign(resolvedParticipant, { entryId, entryWasCreated: true });
        const { data: entry, error: entryError } = await db()
          .from("entries")
          .insert({
            id: entryId,
            event_id: eventId,
            entry_type: "individual",
            display_name: identityName,
            status: "active",
          })
          .select("id")
          .single();

        if (entryError) fail(entryError, `${identityName}의 출전 정보를 생성하지 못했습니다.`);
        resolvedParticipant.entryId = entry.id;

        const entryParticipantId = newDatabaseId();
        resolvedParticipant.entryParticipantId = entryParticipantId;
        const { data: entryParticipant, error: participantError } = await db()
          .from("entry_participants")
          .insert({
            id: entryParticipantId,
            event_id: eventId,
            entry_id: entry.id,
            registration_id: resolvedParticipant.registrationId,
            player_id: resolvedParticipant.playerId,
            member_order: 1,
          })
          .select("id")
          .single();

        if (participantError) fail(participantError, `${identityName}의 출전 선수를 생성하지 못했습니다.`);
        resolvedParticipant.entryParticipantId = entryParticipant.id;
      }
    }
  } catch (error) {
    try {
      await rollbackEventParticipantIdentityChanges(eventId, resolved);
    } catch (rollbackError) {
      throw rollbackFailure(error, rollbackError.rollbackErrors || [rollbackError]);
    }
    throw error;
  }

  return resolved;
}

export async function confirmEventTeamsForBracket(eventId, participants = []) {
  if (!eventId) throw new Error("연결된 대회가 없습니다.");

  const { teams, members } = buildTeamMemberCandidates(participants);
  const { event, actualParticipants, plans } = await preflightEventParticipantIdentities(
    eventId,
    members,
    { requireEmptyEntries: true, requireTeamEvent: true }
  );
  const resolved = await writeEventParticipantIdentities(eventId, plans);

  try {
    for (const team of teams) {
      const teamMembers = resolved
        .filter(member => member.teamParticipantId === team.id)
        .sort((a, b) => a.memberOrder - b.memberOrder);
      const entryId = newDatabaseId();

      teamMembers.forEach((member, index) => {
        member.entryId = entryId;
        member.entryWasCreated = index === 0;
      });

      const { data: entry, error: entryError } = await db()
        .from("entries")
        .insert({
          id: entryId,
          event_id: eventId,
          entry_type: "team",
          display_name: team.name,
          status: "active",
        })
        .select("id")
        .single();

      if (entryError) fail(entryError, `'${team.name}' 팀 출전 정보를 생성하지 못했습니다.`);

      for (const member of teamMembers) {
        const entryParticipantId = newDatabaseId();
        member.entryId = entry.id;
        member.entryParticipantId = entryParticipantId;

        const { data: entryParticipant, error: participantError } = await db()
          .from("entry_participants")
          .insert({
            id: entryParticipantId,
            event_id: eventId,
            entry_id: entry.id,
            registration_id: member.registrationId,
            player_id: member.playerId,
            member_order: member.memberOrder,
            role: member.memberOrder === 1 ? "captain" : null,
          })
          .select("id")
          .single();

        if (participantError) {
          fail(participantError, `'${team.name}' 팀의 ${member.name} 출전 선수를 생성하지 못했습니다.`);
        }
        member.entryParticipantId = entryParticipant.id;
      }
    }

    if (
      resolved.length !== actualParticipants.length ||
      resolved.some(row => !row.playerId || !row.registrationId || !row.entryId || !row.entryParticipantId)
    ) {
      throw new Error("모든 팀 참가자의 선수, 참가 신청, 출전 정보를 확정하지 못했습니다.");
    }

    const confirmedTeams = attachConfirmedTeamIdentities(teams, resolved);

    return {
      eventId,
      previousEventStatus: event.status,
      confirmedAt: new Date().toISOString(),
      participants: confirmedTeams,
      identityChanges: resolved.map(row => ({
        participantId: row.id,
        teamParticipantId: row.teamParticipantId,
        name: row.name,
        memberOrder: row.memberOrder,
        registrationId: row.registrationId,
        playerId: row.playerId,
        entryId: row.entryId,
        entryParticipantId: row.entryParticipantId,
        playerWasCreated: !!row.playerWasCreated,
        registrationWasCreated: !!row.registrationWasCreated,
        registrationPlayerWasLinked: !!row.registrationPlayerWasLinked,
        entryWasCreated: !!row.entryWasCreated,
      })),
    };
  } catch (error) {
    try {
      await rollbackEventParticipantIdentityChanges(eventId, resolved);
    } catch (rollbackError) {
      throw rollbackFailure(error, rollbackError.rollbackErrors || [rollbackError]);
    }
    throw error;
  }
}

export async function validateEventParticipantEntries(eventId, participants = []) {
  if (!eventId) throw new Error("연결된 대회가 없습니다.");

  const actualParticipants = actualIndividualParticipants(
    participants,
    "기록에 반영할 실제 참가자가 없습니다."
  );
  const event = await getEvent(eventId);
  if (!event) throw new Error("연결된 대회를 찾을 수 없습니다.");
  if (event.is_team_event) throw new Error("팀전 대회의 출전 정보 검증은 아직 지원하지 않습니다.");
  if (!["open", "running"].includes(event.status) || event.record_applied_at) {
    throw new Error("현재 기록을 반영할 수 없는 대회입니다.");
  }

  if (actualParticipants.some(row => !row.registrationId || !row.playerId || !row.entryId)) {
    throw new Error("일부 참가자에게 출전 정보가 없습니다. 전환 이전 대진표는 기존 식별 정보 확정 경로를 사용해야 합니다.");
  }

  for (const [label, values] of [
    ["참가 신청", actualParticipants.map(row => row.registrationId)],
    ["선수", actualParticipants.map(row => row.playerId)],
    ["출전", actualParticipants.map(row => row.entryId)],
  ]) {
    if (new Set(values).size !== values.length) {
      throw new Error(`동일한 ${label} 식별 정보가 대진표 참가자 두 명 이상에게 연결되어 있습니다.`);
    }
  }

  const registrationIds = actualParticipants.map(row => row.registrationId);
  const entryIds = actualParticipants.map(row => row.entryId);
  const [{ data: registrations, error: registrationError }, { data: entries, error: entryError }, { data: entryParticipants, error: participantError }] = await Promise.all([
    db()
      .from("event_registrations")
      .select("id, event_id, player_id, registration_name")
      .eq("event_id", eventId)
      .in("id", registrationIds),
    db()
      .from("entries")
      .select("id, event_id, entry_type, status")
      .eq("event_id", eventId)
      .in("id", entryIds),
    db()
      .from("entry_participants")
      .select("id, event_id, entry_id, registration_id, player_id, member_order")
      .eq("event_id", eventId)
      .in("entry_id", entryIds),
  ]);

  if (registrationError) fail(registrationError, "참가자의 참가 신청 정보를 확인하지 못했습니다.");
  if (entryError) fail(entryError, "참가자의 출전 정보를 확인하지 못했습니다.");
  if (participantError) fail(participantError, "참가자의 출전 선수 정보를 확인하지 못했습니다.");

  const registrationById = new Map((registrations || []).map(row => [row.id, row]));
  const entryById = new Map((entries || []).map(row => [row.id, row]));
  const participantByEntryId = new Map((entryParticipants || []).map(row => [row.entry_id, row]));

  return actualParticipants.map(participant => {
    const registration = registrationById.get(participant.registrationId);
    const entry = entryById.get(participant.entryId);
    const entryParticipant = participantByEntryId.get(participant.entryId);

    if (!registration || registration.player_id !== participant.playerId) {
      throw new Error(`'${participant.name}' 참가자의 참가 신청과 선수 연결이 현재 데이터베이스와 일치하지 않습니다.`);
    }
    if (!entry || entry.entry_type !== "individual" || entry.status !== "active") {
      throw new Error(`'${participant.name}' 참가자의 활성 개인 출전 정보를 찾을 수 없습니다.`);
    }
    if (
      !entryParticipant ||
      entryParticipant.registration_id !== participant.registrationId ||
      entryParticipant.player_id !== participant.playerId ||
      entryParticipant.member_order !== 1
    ) {
      throw new Error(`'${participant.name}' 참가자의 출전 선수 연결이 현재 데이터베이스와 일치하지 않습니다.`);
    }

    return { ...participant, entryParticipantId: entryParticipant.id };
  });
}

export async function validateEventTeamEntries(eventId, teams = []) {
  if (!eventId) throw new Error("연결된 대회가 없습니다.");

  const actualTeams = actualTeamParticipants(
    teams,
    "기록에 반영할 실제 참가 팀이 없습니다."
  );
  const event = await getEvent(eventId);
  if (!event) throw new Error("연결된 대회를 찾을 수 없습니다.");
  if (!event.is_team_event) throw new Error("개인전 대회에는 팀 출전 정보를 검증할 수 없습니다.");
  if (![
    "open",
    "running",
  ].includes(event.status) || event.record_applied_at) {
    throw new Error("현재 기록을 반영할 수 없는 대회입니다.");
  }

  const entryIds = actualTeams.map(team => team.entryId);
  if (entryIds.some(entryId => !entryId)) {
    throw new Error("일부 팀에 출전 정보가 없습니다. 참가 확정 이후 대진표를 다시 확인해 주세요.");
  }
  if (new Set(entryIds).size !== entryIds.length) {
    throw new Error("동일한 팀 출전 정보가 대진표 팀 두 개 이상에 연결되어 있습니다.");
  }

  const expectedMembersByEntryId = new Map();
  const expectedMembers = [];
  for (const team of actualTeams) {
    const members = getConfirmedTeamMemberIdentities(team);
    if (members.some(member => !member.registrationId || !member.playerId || !member.entryParticipantId)) {
      throw new Error(`'${team.name}' 팀의 참가 신청, 선수, 출전 선수 정보가 완전하지 않습니다.`);
    }

    const playerIds = members.map(member => member.playerId);
    if (new Set(playerIds).size !== playerIds.length) {
      throw new Error(`'${team.name}' 팀의 선수 정보가 중복되어 있습니다.`);
    }
    const entryParticipantIds = members.map(member => member.entryParticipantId);
    if (new Set(entryParticipantIds).size !== entryParticipantIds.length) {
      throw new Error(`'${team.name}' 팀의 출전 선수 정보가 중복되어 있습니다.`);
    }

    expectedMembersByEntryId.set(team.entryId, members);
    expectedMembers.push(...members.map(member => ({ team, member })));
  }

  const registrationIds = expectedMembers.map(({ member }) => member.registrationId);
  const [{ data: registrations, error: registrationError }, { data: entries, error: entryError }, { data: entryParticipants, error: participantError }] = await Promise.all([
    db()
      .from("event_registrations")
      .select("id, event_id, player_id, registration_name")
      .eq("event_id", eventId)
      .in("id", registrationIds),
    db()
      .from("entries")
      .select("id, event_id, entry_type, status")
      .eq("event_id", eventId)
      .in("id", entryIds),
    db()
      .from("entry_participants")
      .select("id, event_id, entry_id, registration_id, player_id, member_order")
      .eq("event_id", eventId)
      .in("entry_id", entryIds),
  ]);

  if (registrationError) fail(registrationError, "팀 참가자의 참가 신청 정보를 확인하지 못했습니다.");
  if (entryError) fail(entryError, "팀의 출전 정보를 확인하지 못했습니다.");
  if (participantError) fail(participantError, "팀의 출전 선수 정보를 확인하지 못했습니다.");

  const registrationById = new Map((registrations || []).map(row => [row.id, row]));
  const entryById = new Map((entries || []).map(row => [row.id, row]));
  const participantsByEntryId = new Map();
  for (const row of entryParticipants || []) {
    const rows = participantsByEntryId.get(row.entry_id) || [];
    rows.push(row);
    participantsByEntryId.set(row.entry_id, rows);
  }

  return actualTeams.map(team => {
    const entry = entryById.get(team.entryId);
    if (!entry || entry.entry_type !== "team" || entry.status !== "active") {
      throw new Error(`'${team.name}' 팀의 활성 팀 출전 정보를 찾을 수 없습니다.`);
    }

    const members = expectedMembersByEntryId.get(team.entryId) || [];
    const dbMembers = participantsByEntryId.get(team.entryId) || [];
    if (dbMembers.length !== members.length) {
      throw new Error(`'${team.name}' 팀의 출전 선수 구성이 현재 데이터베이스와 일치하지 않습니다.`);
    }

    const verifiedMembers = members.map(member => {
      const registration = registrationById.get(member.registrationId);
      const entryParticipant = dbMembers.find(row => row.id === member.entryParticipantId);
      if (!registration || registration.player_id !== member.playerId) {
        throw new Error(`'${team.name}' 팀원 '${member.name}'의 참가 신청과 선수 연결이 현재 데이터베이스와 일치하지 않습니다.`);
      }
      if (
        !entryParticipant ||
        entryParticipant.entry_id !== team.entryId ||
        entryParticipant.registration_id !== member.registrationId ||
        entryParticipant.player_id !== member.playerId ||
        entryParticipant.member_order !== member.memberOrder
      ) {
        throw new Error(`'${team.name}' 팀원 '${member.name}'의 출전 선수 연결이 현재 데이터베이스와 일치하지 않습니다.`);
      }

      return { ...member, entryParticipantId: entryParticipant.id };
    });

    return { ...team, memberIdentities: verifiedMembers };
  });
}

export async function inspectEventParticipantIdentities(eventId, participants = []) {
  if (!eventId) return [];

  const actualParticipants = (participants || [])
    .filter(p => !Array.isArray(p.members))
    .map(p => ({
      ...p,
      name: String(p.name || "").trim(),
    }))
    .filter(p => p.name);

  if (!actualParticipants.length) return [];

  const { data: registrations, error: registrationError } = await db()
    .from("event_registrations")
    .select("id, event_id, player_id, registration_name, registration_source")
    .eq("event_id", eventId);

  if (registrationError) fail(registrationError, "대회 참가자 식별 정보를 확인하지 못했습니다.");

  const registrationById = new Map((registrations || []).map(row => [row.id, row]));

  const rows = actualParticipants.map(participant => {
    let registration = null;
    let registrationAmbiguous = false;

    if (participant.registrationId) {
      registration = registrationById.get(participant.registrationId) || null;
    }

    if (!registration) {
      const matches = (registrations || []).filter(
        row => playerNameKey(row.registration_name) === playerNameKey(participant.name)
      );

      if (matches.length > 1) {
        registrationAmbiguous = true;
      } else if (matches.length === 1) {
        registration = matches[0];
      }
    }

    return {
      participant,
      registration,
      registrationAmbiguous,
      identityName: String(registration?.registration_name || participant.name).trim(),
    };
  });

  const players = rows.some(row => !row.registrationAmbiguous && !row.registration?.player_id)
    ? await loadPlayerNames()
    : [];

  return rows.map(row => {
    const { participant, registration, identityName, registrationAmbiguous } = row;

    if (registrationAmbiguous) {
      return {
        participantId: participant.id,
        name: participant.name,
        registrationId: null,
        playerId: null,
        status: "ambiguous",
        reason: "동일 이름의 참가 신청이 여러 건 존재",
        willCreateRegistration: false,
      };
    }

    if (registration?.player_id) {
      return {
        participantId: participant.id,
        name: participant.name,
        registrationId: registration.id,
        playerId: registration.player_id,
        status: "existing",
        willCreateRegistration: false,
      };
    }

    const matches = players.filter(player => playerNameKey(player.display_name) === playerNameKey(identityName));

    if (matches.length > 1) {
      return {
        participantId: participant.id,
        name: participant.name,
        registrationId: registration?.id || null,
        playerId: null,
        status: "ambiguous",
        willCreateRegistration: !registration,
      };
    }

    if (matches.length === 1) {
      return {
        participantId: participant.id,
        name: participant.name,
        registrationId: registration?.id || null,
        playerId: matches[0].id,
        status: "existing",
        willCreateRegistration: !registration,
      };
    }

    return {
      participantId: participant.id,
      name: participant.name,
      registrationId: registration?.id || null,
      playerId: null,
      status: "new",
      willCreateRegistration: !registration,
    };
  });
}

