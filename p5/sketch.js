// 복잡한 통신은 serial-helper.js가 처리합니다. (serial-helper.js는 그대로 사용)
let serial, connectButton, slider, gammaBox;
let ledOn = false;          // D8 ON/OFF LED
let potValue = 0;           // A0 가변저항
let arduinoPwm = 0;         // Arduino가 실제로 적용했다고 알려준 값
let statusText = 'Arduino를 연결해 주세요.';

// 슬라이더 → 전송 관리
let sentPwm = -1;           // 마지막으로 보낸 값 (-1 = 아직 없음)
let sending = false;
let lastSendTime = 0;
const SEND_INTERVAL = 40;   // ms, 9600 baud가 밀리지 않도록 전송 간격 제한

function setup() {
  createCanvas(720, 440);
  textFont('sans-serif');

  serial = new SerialHelper(9600, receiveLine, message => {
    statusText = message;
    if (message.startsWith('연결됨')) sentPwm = -1;   // 재연결 시 현재 값 다시 전송
  });

  connectButton = createButton('Arduino 연결 / 해제');
  connectButton.mousePressed(() => serial.toggle());

  createSpan('  D9 밝기 ');
  slider = createSlider(0, 100, 0, 1);   // 0~100 %
  slider.style('width', '260px');

  gammaBox = createCheckbox(' 감마 보정 (눈에 균일한 밝기)', true);
}

// 슬라이더 % → PWM 0~255
function targetPwm() {
  const p = slider.value() / 100;
  return gammaBox.checked()
    ? round(255 * pow(p, 2.2))   // 사람 눈은 밝기를 비선형으로 느끼므로 보정
    : round(255 * p);
}

function draw() {
  background(242, 246, 250);
  const pwm = targetPwm();
  sendPwmIfNeeded(pwm);

  // ---- 제목 / 상태 ----
  fill(25, 40, 60); noStroke(); textAlign(CENTER);
  textSize(24); text('p5 슬라이더로 LED 밝기 조절 · Web Serial', width / 2, 36);
  textSize(14); text(statusText, width / 2, 62);

  // ---- D8 ON/OFF LED ----
  fill(ledOn ? '#22c55e' : '#64748b');
  circle(120, 170, 100);
  fill(255); textSize(20); text(ledOn ? 'ON' : 'OFF', 120, 177);
  fill(25, 40, 60); textSize(14);
  text('D8 · 클릭하면 토글', 120, 245);

  // ---- D9 PWM LED (빛 번짐 효과) ----
  drawGlowBulb(360, 170, pwm);
  fill(25, 40, 60); textSize(14);
  text('D9 · 슬라이더 ' + slider.value() + '%  →  PWM ' + pwm, 360, 245);
  fill(arduinoPwm === pwm ? '#16a34a' : '#b45309');
  text('Arduino 적용값: ' + arduinoPwm, 360, 266);

  // ---- A0 가변저항 ----
  fill(25, 40, 60); textSize(14);
  text('A0 가변저항', 600, 128);
  fill('#dbe3ed'); rect(510, 145, 180, 34, 8);
  fill('#3b82f6'); rect(510, 145, map(potValue, 0, 1023, 0, 180), 34, 8);
  fill(25, 40, 60); textSize(20); text(potValue + ' / 1023', 600, 215);

  // ---- PWM 파형 (듀티비 시각화) ----
  drawPwmWave(pwm);
}

// 슬라이더 값이 바뀌었을 때만, 일정 간격으로 전송
function sendPwmIfNeeded(pwm) {
  if (!serial.writer || sending) return;
  if (pwm === sentPwm || millis() - lastSendTime < SEND_INTERVAL) return;

  sending = true;
  lastSendTime = millis();
  serial.send('PWM:' + pwm).then(ok => {
    if (ok) sentPwm = pwm;
    sending = false;
  });
}

// 밝기에 따라 노란 빛이 퍼지는 전구
function drawGlowBulb(x, y, pwm) {
  const k = pwm / 255;
  noStroke();
  for (let r = 6; r >= 1; r--) {
    fill(255, 200, 40, 40 * k);
    circle(x, y, 90 + r * 22 * k);
  }
  fill(lerpColor(color('#475569'), color('#facc15'), k));
  circle(x, y, 90);
  fill(k > 0.5 ? 40 : 255); textSize(18);
  text(round(k * 100) + '%', x, y + 6);
}

// 아래쪽에 실제 PWM 파형(5V ↔ 0V)을 그려 듀티비를 보여줌
function drawPwmWave(pwm) {
  const x0 = 60, x1 = width - 60, yHigh = 330, yLow = 390;
  const periods = 6, w = (x1 - x0) / periods;
  const duty = pwm / 255;

  fill(25, 40, 60); noStroke(); textSize(13); textAlign(LEFT);
  text('D9 PWM 파형 · 듀티비 ' + nf(duty * 100, 1, 1) + '% (약 490 Hz)', x0, 312);
  text('5V', 30, yHigh + 4); text('0V', 30, yLow + 4);
  textAlign(CENTER);

  stroke('#f59e0b'); strokeWeight(2.5); noFill();
  beginShape();
  for (let i = 0; i < periods; i++) {
    const sx = x0 + i * w, ex = sx + w * duty;
    if (duty <= 0) { vertex(sx, yLow); vertex(sx + w, yLow); continue; }
    if (duty >= 1) { vertex(sx, yHigh); vertex(sx + w, yHigh); continue; }
    vertex(sx, yLow); vertex(sx, yHigh); vertex(ex, yHigh);
    vertex(ex, yLow); vertex(sx + w, yLow);
  }
  endShape();
  noStroke();
}

async function mousePressed() {
  if (dist(mouseX, mouseY, 120, 170) > 50) return;
  const next = !ledOn;
  if (await serial.send(next ? 'ON' : 'OFF')) ledOn = next;
}

function receiveLine(line) {
  // Arduino가 보내는 한 줄을 화면에 반영합니다.
  const message = line.trim().toUpperCase();
  if (message === 'LED: ON' || message === 'ON') ledOn = true;
  else if (message === 'LED: OFF' || message === 'OFF') ledOn = false;
  else if (message.startsWith('PWM')) {
    const m = message.match(/^PWM\s*[:=]\s*(\d+)$/);
    if (m) arduinoPwm = constrain(Number(m[1]), 0, 255);
  }
  else {
    const match = message.match(/^(?:POT\s*[:=]\s*)?(\d+)$/);
    if (match) potValue = constrain(Number(match[1]), 0, 1023);
  }
}
