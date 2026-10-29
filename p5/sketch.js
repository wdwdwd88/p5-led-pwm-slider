// 복잡한 통신은 serial-helper.js가 처리합니다. (serial-helper.js는 그대로 사용)
let serial, connectButton, slider;
let ledOn = false;
let potValue = 0;
let statusText = 'Arduino를 연결해 주세요.';

let sentPwm = -1;      // 마지막으로 보낸 PWM 값
let sending = false;

function setup() {
  createCanvas(600, 400);
  textFont('sans-serif');
  serial = new SerialHelper(9600, receiveLine, message => {
    statusText = message;
    if (message.startsWith('연결됨')) sentPwm = -1;   // 재연결 시 현재 값 다시 전송
  });
  connectButton = createButton('Arduino 연결 / 해제');
  connectButton.mousePressed(() => serial.toggle());

  createSpan('  D9 밝기 ');
  slider = createSlider(0, 255, 0, 1);   // PWM 0~255
}

function draw() {
  background(242, 246, 250);
  sendPwm();

  fill(25, 40, 60); noStroke(); textAlign(CENTER);
  textSize(24); text('Arduino Uno R3 · Web Serial', width / 2, 36);
  textSize(14); text(statusText, width / 2, 66);
  fill(ledOn ? '#22c55e' : '#64748b');
  circle(160, 175, 110);
  fill(255); textSize(22); text(ledOn ? 'ON' : 'OFF', 160, 183);
  fill(25, 40, 60); textSize(15); text('원을 클릭하면 LED 토글', 160, 260);
  text('가변저항 A0', 420, 120);
  fill('#dbe3ed'); rect(310, 155, 220, 40, 10);
  fill('#3b82f6'); rect(310, 155, map(potValue, 0, 1023, 0, 220), 40, 10);
  fill(25, 40, 60); textSize(24); text(potValue + ' / 1023', 420, 235);
  textSize(18); text('D9 밝기 (PWM): ' + slider.value() + ' / 255', 300, 300);
  textSize(14); text('9600 baud · ON / OFF / PWM:0~255 + 줄바꿈', 300, 352);
}

// 슬라이더 값이 바뀌었을 때만 전송
function sendPwm() {
  const pwm = slider.value();
  if (!serial.writer || sending || pwm === sentPwm) return;
  sending = true;
  serial.send('PWM:' + pwm).then(ok => {
    if (ok) sentPwm = pwm;
    sending = false;
  });
}

async function mousePressed() {
  if (dist(mouseX, mouseY, 160, 175) > 55) return;
  const next = !ledOn;
  if (await serial.send(next ? 'ON' : 'OFF')) ledOn = next;
}

function receiveLine(line) {
  // Arduino가 보내는 한 줄을 화면에 반영합니다.
  const message = line.trim().toUpperCase();
  if (message === 'LED: ON' || message === 'ON') ledOn = true;
  else if (message === 'LED: OFF' || message === 'OFF') ledOn = false;
  else {
    const match = message.match(/^(?:POT\s*[:=]\s*)?(\d+)$/);
    if (match) potValue = constrain(Number(match[1]), 0, 1023);
  }
}
