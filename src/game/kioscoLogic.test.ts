import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COUNTER_DELIVERY_ZONE,
  COUNTER_SURFACE_Y,
  KIOSCO_UPGRADES,
  NIGHT_CHAPTERS,
  SECRET_EVENTS,
  SENSITIVITY_PRESETS,
  SHIFT_TARGET_MINUTES,
  STORY_ENCOUNTERS,
  applyJoystickResponse,
  buildIntroBeats,
  buildMissionSteps,
  calculatePayment,
  computeAmbientAudioParams,
  computeHorrorThreatLevel,
  computeNextHorrorIntervalSec,
  createInitialRestockZones,
  createInitialSoldRecords,
  createInitialStock,
  evaluateCounterOrder,
  formatShiftClock,
  getFriendVoiceProfile,
  getNarratorVoiceProfile,
  getNightEncounter,
  getNpcScaredLine,
  getNpcVoiceProfile,
  getOrganizedInventoryRows,
  getPlayerZoneLabel,
  isPointInDeliveryZone,
  normalizeGeminiEncounter,
  pickHorrorEvent,
  recordSaleToInventory,
  resolvePlayerMapPosition,
  sanitizeActionButtonLayouts,
  sanitizePlayerProfile,
  sanitizeRoomCode,
  tickRestockZones,
  tryRestockZoneWithProduct,
} from './kioscoLogic';

test('delivery zone accepts items resting on the checkout counter and rejects floor or aisles', () => {
  const cx = (COUNTER_DELIVERY_ZONE.minX + COUNTER_DELIVERY_ZONE.maxX) / 2;
  const cz = (COUNTER_DELIVERY_ZONE.minZ + COUNTER_DELIVERY_ZONE.maxZ) / 2;
  assert.equal(isPointInDeliveryZone(cx, COUNTER_SURFACE_Y + 0.04, cz), true);
  assert.equal(isPointInDeliveryZone(cx, 0.1, cz), false);
  assert.equal(isPointInDeliveryZone(2.5, COUNTER_SURFACE_Y + 0.04, cz), false);
});

test('supermarket collision map lets player walk aisles, Depósito doorway, and front parking lot while checkout blocks pass-through', () => {
  // Center aisle clear
  const center = resolvePlayerMapPosition(0, 1.5);
  assert.equal(center.x, 0);
  assert.equal(center.z, 1.5);

  // Open doorway into Depósito (x=0, z=5.0 -> z=6.2)
  const deposito = resolvePlayerMapPosition(0, 6.2);
  assert.equal(deposito.x, 0);
  assert.equal(deposito.z, 6.2);
  assert.equal(getPlayerZoneLabel(deposito.x, deposito.z), 'Depósito / Almacén');

  // Open front sliding door (x=0, z=-6.0 -> z=-8.2) out to dark parking lot
  const parking = resolvePlayerMapPosition(0, -8.2);
  assert.equal(parking.x, 0);
  assert.equal(parking.z, -8.2);
  assert.equal(getPlayerZoneLabel(parking.x, parking.z), 'Estacionamiento Oscuro');

  // Checkout counter blocks straight pass-through
  const hitCounter = resolvePlayerMapPosition(-3.5, -3.5);
  assert.ok(hitCounter.x !== -3.5 || hitCounter.z !== -3.5);
});

test('formatShiftClock tracks 00:00 AM full-time shift up to 03:00 AM renewal mark', () => {
  const start = formatShiftClock(0);
  assert.equal(start.timeLabel, '00:00 AM');
  assert.equal(start.progressPercent, 0);
  assert.equal(start.isShiftComplete, false);

  const mid = formatShiftClock(90);
  assert.equal(mid.timeLabel, '01:30 AM');
  assert.equal(mid.progressPercent, 50);
  assert.equal(mid.isShiftComplete, false);

  const end = formatShiftClock(SHIFT_TARGET_MINUTES);
  assert.equal(end.timeLabel, '03:00 AM');
  assert.equal(end.progressPercent, 100);
  assert.equal(end.isShiftComplete, true);
});

test('tickRestockZones depletes shelf food and tryRestockZoneWithProduct refills matching food', () => {
  const initial = createInitialRestockZones();
  assert.equal(initial.length, 4);
  assert.equal(initial[0].id, 'heladera_carnes');
  assert.equal(initial[0].needsRestock, true);

  const ticked = tickRestockZones(initial, 30, 1.5, true);
  assert.ok(ticked.nextZones[0].stockPercent < initial[0].stockPercent);
  assert.ok(ticked.criticalCount >= 1);
  assert.ok(ticked.stabilityDrain > 0);

  const wrongItem = tryRestockZoneWithProduct(ticked.nextZones, 'heladera_carnes', 'gaseosa', 45);
  assert.equal(wrongItem.ok, false);

  const rightItem = tryRestockZoneWithProduct(ticked.nextZones, 'heladera_carnes', 'carne', 45);
  assert.equal(rightItem.ok, true);
  assert.ok(rightItem.bonusCash >= 450);
  assert.ok(rightItem.stabilityGain >= 7);
  const refreshed = rightItem.nextZones.find((z) => z.id === 'heladera_carnes')!;
  assert.equal(refreshed.stockPercent, 100);
  assert.equal(refreshed.needsRestock, false);
  assert.equal(refreshed.isCritical, false);
});

test('buildIntroBeats returns 3 horror supermarket story beats personalized with player and friend names', () => {
  const beats = buildIntroBeats('Mateo', 'El Negro');
  assert.equal(beats.length, 3);
  assert.ok(beats[0].title.includes('03:00 AM'));
  assert.ok(beats[0].speakerLine.includes('Mateo'));
  assert.ok(beats[0].speakerLine.includes('El Negro'));
  assert.ok(beats[0].friendSpeech.includes('Mateo'));
  assert.ok(beats[1].narration.includes('Depósito'));
});

test('intro narrator, friend, and every story NPC have distinct voice profiles', () => {
  const narrator = getNarratorVoiceProfile();
  const friend = getFriendVoiceProfile('El Tucu');
  assert.ok(narrator.pitch < friend.pitch);
  assert.ok(narrator.label.includes('Supervisor'));

  const voiceIds = new Set<string>();
  const voiceKeys = new Set<string>();
  for (const enc of STORY_ENCOUNTERS) {
    assert.ok(enc.voiceProfile, `Missing voiceProfile on ${enc.id}`);
    assert.ok(enc.voiceProfile.voiceName);
    assert.ok(enc.voiceProfile.voiceStyle.length > 10);
    voiceIds.add(enc.voiceProfile.id);
    voiceKeys.add(`${enc.voiceProfile.voiceName}:${enc.voiceProfile.pitch}:${enc.voiceProfile.rate}`);
  }
  assert.equal(voiceIds.size, STORY_ENCOUNTERS.length);
  assert.equal(voiceKeys.size, STORY_ENCOUNTERS.length);

  const marta = STORY_ENCOUNTERS.find((e) => e.id === 'story-2')!;
  const sergio = STORY_ENCOUNTERS.find((e) => e.id === 'story-1')!;
  assert.equal(marta.voiceProfile!.preferredGender, 'female');
  assert.equal(marta.voiceProfile!.voiceName, 'Kore');
  assert.equal(sergio.voiceProfile!.preferredGender, 'male');
  assert.equal(sergio.voiceProfile!.voiceName, 'Fenrir');
  assert.ok(marta.voiceProfile!.pitch > sergio.voiceProfile!.pitch);
  assert.ok(getNpcScaredLine(marta).length > 10);

  const customA = getNpcVoiceProfile('turista', 'Sofía de Córdoba', 'g1');
  const customB = getNpcVoiceProfile('turista', 'Carlos de Salta', 'g2');
  assert.equal(customA.preferredGender, 'female');
  assert.equal(customB.preferredGender, 'male');
  assert.notEqual(customA.id, customB.id);
});

test('evaluateCounterOrder counts physical items inside the checkout delivery zone', () => {
  const cx = (COUNTER_DELIVERY_ZONE.minX + COUNTER_DELIVERY_ZONE.maxX) / 2;
  const cz = (COUNTER_DELIVERY_ZONE.minZ + COUNTER_DELIVERY_ZONE.maxZ) / 2;

  const evalIncomplete = evaluateCounterOrder(
    [
      { productId: 'carne', quantity: 1 },
      { productId: 'cafe', quantity: 1 },
    ],
    [{ instanceId: 'i1', productId: 'carne', x: cx, y: COUNTER_SURFACE_Y + 0.03, z: cz }]
  );
  assert.equal(evalIncomplete.isComplete, false);
  assert.equal(evalIncomplete.missingCount, 1);
  assert.equal(evalIncomplete.totalRequestedPrice, 6300);

  const evalComplete = evaluateCounterOrder(
    [
      { productId: 'carne', quantity: 1 },
      { productId: 'cafe', quantity: 1 },
    ],
    [
      { instanceId: 'i1', productId: 'carne', x: cx, y: COUNTER_SURFACE_Y + 0.03, z: cz },
      { instanceId: 'i2', productId: 'cafe', x: cx + 0.2, y: COUNTER_SURFACE_Y + 0.14, z: cz },
      { instanceId: 'i3', productId: 'pan', x: cx - 0.2, y: COUNTER_SURFACE_Y + 0.1, z: cz },
    ]
  );
  assert.equal(evalComplete.isComplete, true);
  assert.equal(evalComplete.missingCount, 0);
  assert.equal(evalComplete.extraOnCounter.length, 1);
  assert.equal(evalComplete.extraOnCounter[0].productId, 'pan');
});

test('calculatePayment validates cash tendered and exact QR transfer', () => {
  const shortCash = calculatePayment(3000, 2000, 'efectivo');
  assert.equal(shortCash.ok, false);
  assert.ok(shortCash.error);

  const exactCash = calculatePayment(3000, 5000, 'efectivo');
  assert.equal(exactCash.ok, true);
  assert.equal(exactCash.change, 2000);

  const qrPay = calculatePayment(3000, 0, 'qr');
  assert.equal(qrPay.ok, true);
  assert.equal(qrPay.change, 0);
});

test('recordSaleToInventory updates stock, sold quantities, revenue, and sorting', () => {
  const stock = createInitialStock();
  const sold = createInitialSoldRecords();

  const after1 = recordSaleToInventory(
    stock,
    sold,
    [
      { productId: 'carne', quantity: 2 },
      { productId: 'gaseosa', quantity: 1 },
    ],
    'Sergio (Guardia Nocturno)'
  );
  assert.equal(after1.revenueAdded, 8900);
  assert.equal(after1.nextStock.carne, 3);
  assert.equal(after1.nextSold.carne.quantitySold, 2);
  assert.equal(after1.nextSold.carne.lastSoldCustomer, 'Sergio (Guardia Nocturno)');

  const rows = getOrganizedInventoryRows(after1.nextStock, after1.nextSold, 'Todas', 'sold_desc');
  assert.equal(rows[0].product.id, 'carne');
  assert.equal(rows[1].product.id, 'gaseosa');

  const drinksOnly = getOrganizedInventoryRows(after1.nextStock, after1.nextSold, 'Bebidas', 'name_asc');
  assert.equal(drinksOnly.length, 2);
});

test('normalizeGeminiEncounter sanitizes invalid items, archetypes, and attaches voiceProfile', () => {
  const normalized = normalizeGeminiEncounter(
    {
      npcName: 'Inspector de Madrugada',
      archetype: 'unknown_type',
      greeting: 'Hola chicos',
      friendComment: 'Mirá quién entró al súper',
      thanksLine: 'Chau',
      isSuspicious: true,
      paymentMethod: 'qr',
      items: [
        { productId: 'leche', quantity: 2 },
        { productId: 'invalid_item', quantity: 9 },
      ],
    },
    'test'
  );
  assert.equal(normalized.archetype, 'turista');
  assert.equal(normalized.items.length, 1);
  assert.equal(normalized.items[0].productId, 'leche');
  assert.equal(normalized.paymentMethod, 'qr');
  assert.equal(normalized.isSuspicious, true);
  assert.ok(normalized.voiceProfile);
  assert.ok(normalized.voiceProfile.label.includes('Cliente'));
});

test('buildMissionSteps prioritizes attacking NPC, then urgent restock, then counter order', () => {
  const npc = STORY_ENCOUNTERS[0]; // Sergio: carne + cafe
  const evalEmpty = evaluateCounterOrder(npc.items, []);
  const restockZones = createInitialRestockZones();
  const urgentZone = restockZones[0]; // heladera_carnes accepts carne/leche

  const stepsUrgentIdle = buildMissionSteps(npc, 'waiting', null, evalEmpty, urgentZone);
  assert.ok(stepsUrgentIdle[0].id.startsWith('restock-need-'));
  assert.ok(stepsUrgentIdle[0].text.includes('Depósito'));

  const stepsUrgentHolding = buildMissionSteps(npc, 'waiting', 'carne', evalEmpty, urgentZone);
  assert.ok(stepsUrgentHolding[0].id.startsWith('restock-drop-'));
  assert.ok(stepsUrgentHolding[0].text.includes('Reponer'));

  const cx = (COUNTER_DELIVERY_ZONE.minX + COUNTER_DELIVERY_ZONE.maxX) / 2;
  const cz = (COUNTER_DELIVERY_ZONE.minZ + COUNTER_DELIVERY_ZONE.maxZ) / 2;
  const evalComplete = evaluateCounterOrder(npc.items, [
    { instanceId: 'a', productId: 'carne', x: cx, y: COUNTER_SURFACE_Y + 0.03, z: cz },
    { instanceId: 'b', productId: 'cafe', x: cx + 0.2, y: COUNTER_SURFACE_Y + 0.14, z: cz },
  ]);
  const stepsDone = buildMissionSteps(npc, 'waiting', null, evalComplete, null);
  const payStep = stepsDone[stepsDone.length - 1];
  assert.equal(payStep.active, true);
  assert.ok(payStep.text.includes('Pedido listo'));
});

test('sanitizeActionButtonLayouts clamps offsets/scale and formats rebind keys', () => {
  const layout = sanitizeActionButtonLayouts({
    grab: { offsetX: -999, offsetY: 99, scale: 2.5, keyCode: 'Space' },
    drop: { offsetX: -45, offsetY: -60, scale: 0.5, keyCode: 'KeyT' },
  });
  assert.equal(layout.grab.offsetX, -520);
  assert.equal(layout.grab.offsetY, 20);
  assert.equal(layout.grab.scale, 1.45);
  assert.equal(layout.grab.keyLabel, 'ESP');
  assert.equal(layout.drop.offsetX, -45);
  assert.equal(layout.drop.scale, 0.8);
  assert.equal(layout.drop.keyLabel, 'T');
});

test('computeAmbientAudioParams increases tension toward 03:00 AM and critical restocks', () => {
  const earlyOut = computeAmbientAudioParams(10, false, 0);
  const earlyIn = computeAmbientAudioParams(10, true, 0);
  assert.equal(earlyOut.phase, 'noche');
  assert.ok(earlyOut.cricketIntensity > earlyIn.cricketIntensity);
  assert.ok(earlyOut.windGain > earlyIn.windGain);
  assert.ok(earlyIn.fridgeHumGain > earlyOut.fridgeHumGain);

  const lateCritical = computeAmbientAudioParams(165, true, 2);
  assert.equal(lateCritical.phase, 'madrugada');
  assert.ok(lateCritical.tensionGain > earlyIn.tensionGain);
  assert.ok(lateCritical.label.includes('alerta'));
});

test('applyJoystickResponse delivers responsive high-sensitivity curves and room sanitization cleans inputs', () => {
  const dead = applyJoystickResponse(0.01, 0.02, 'alta');
  assert.equal(dead.x, 0);
  assert.equal(dead.z, 0);

  const smallAlta = applyJoystickResponse(0.3, 0, 'alta');
  const smallMedia = applyJoystickResponse(0.3, 0, 'media');
  assert.ok(smallAlta.x > smallMedia.x);
  assert.ok(SENSITIVITY_PRESETS.muy_alta.lookScale > SENSITIVITY_PRESETS.alta.lookScale);

  assert.equal(sanitizeRoomCode('super-99!!'), 'SUPER99');
  assert.equal(sanitizeRoomCode('a'), 'SUPER3');

  const safeProf = sanitizePlayerProfile({
    playerName: '<script>Nico\n',
    friendName: '  Tucu  ',
    shirtId: 'invalid',
    skinTone: 'nothex',
    customModelName: 'monstruo.glb',
  });
  assert.equal(safeProf.playerName, 'scriptNico');
  assert.equal(safeProf.friendName, 'Tucu');
  assert.equal(safeProf.shirtId, 'super_rojo');
  assert.equal(safeProf.customModelName, 'monstruo.glb');
});

test('multi-night horror chapters, upgrades, supermarket secrets, and attacking steps are consistent', () => {
  assert.equal(NIGHT_CHAPTERS.length, 3);
  assert.ok(NIGHT_CHAPTERS[1].encounters.some((e) => e.archetype === 'aparicion'));
  assert.ok(NIGHT_CHAPTERS[2].encounters.some((e) => e.archetype === 'aparicion' && e.canAttack));

  const night2Ghost = getNightEncounter(2, 1);
  assert.equal(night2Ghost.archetype, 'aparicion');
  assert.equal(night2Ghost.voiceProfile?.preferredGender, 'female');
  assert.ok(getNpcScaredLine(night2Ghost).includes('luces'));

  assert.equal(KIOSCO_UPGRADES.length, 4);
  assert.equal(SECRET_EVENTS.length, 3);
  for (const s of SECRET_EVENTS) {
    assert.ok(s.rewardCash >= 1000);
  }

  const attackSteps = buildMissionSteps(night2Ghost, 'attacking', null, null);
  assert.equal(attackSteps[0].id, 'defend-attack');
  assert.ok(attackSteps[0].text.includes('Arma') && attackSteps[0].text.includes('Dispará'));
});

test('computeHorrorThreatLevel and pickHorrorEvent scale with reputation and shift hour', () => {
  const calm = computeHorrorThreatLevel(95, 5, 1);
  const tenseLate = computeHorrorThreatLevel(25, 165, 2);

  assert.ok(tenseLate.threat > calm.threat);
  assert.ok(tenseLate.intervalMaxSec < calm.intervalMinSec);
  assert.ok(tenseLate.weights.shelf_drop > calm.weights.shelf_drop);
  assert.ok(tenseLate.weights.freezer_slam > calm.weights.freezer_slam);

  const calmInterval = computeNextHorrorIntervalSec(95, 5, 1, () => 0.5);
  const lateInterval = computeNextHorrorIntervalSec(25, 165, 2, () => 0.5);
  assert.ok(lateInterval < calmInterval);

  const flickerEvt = pickHorrorEvent(85, 20, 1, 0.05);
  const shadowEvt = pickHorrorEvent(50, 90, 1, 0.45);
  const dropEvt = pickHorrorEvent(30, 140, 2, 0.72);
  const slamEvt = pickHorrorEvent(20, 170, 2, 0.96);

  assert.equal(flickerEvt.type, 'flicker_lights');
  assert.equal(shadowEvt.type, 'aisle_shadow');
  assert.equal(dropEvt.type, 'shelf_drop');
  assert.equal(slamEvt.type, 'freezer_slam');
  assert.ok(slamEvt.intensity > flickerEvt.intensity);
});
