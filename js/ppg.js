// ======================================================
// ppg.js
// Camera access, flashlight control, signal processing,
// BPM calculation, RMSSD and waveform drawing.
// ======================================================

const video = document.getElementById("video");
const hiddenCanvas = document.getElementById("hiddenCanvas");
const ctx = hiddenCanvas.getContext("2d", {
  willReadFrequently: true
});

const chart = document.getElementById("chart");
const chartCtx = chart.getContext("2d");

let stream = null;
let track = null;
let torch = false;

let measuring = false;

let captureTimer = null;
let countdownTimer = null;
let startedAt = 0;

let samples = [];
let signalBuffer = [];
let beats = [];
let lastBeatTime = 0;

const MEASUREMENT_DURATION = 60;

// ------------------------------------------------------
// CAMERA
// ------------------------------------------------------

async function startCamera() {

  try {

    if (!navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia) {

      throw new Error(
        "Camera access is not supported by this browser."
      );
    }

    stream = await navigator.mediaDevices.getUserMedia({

      video: {
        facingMode: {
          ideal: "environment"
        },

        width: {
          ideal: 1280
        },

        height: {
          ideal: 720
        }
      },

      audio: false
    });

    video.srcObject = stream;

    await video.play();

    track = stream.getVideoTracks()[0];

    const capabilities =
      track.getCapabilities?.() || {};

    const torchButton =
      document.getElementById("torchBtn");

    torchButton.disabled = !capabilities.torch;

    document.getElementById("cameraBtn").textContent =
      "✓ Camera Ready";

    document.getElementById("cameraBtn").disabled =
      true;

    document.getElementById("startBtn").disabled =
      false;

    const hint = document.getElementById("hint");

    if (capabilities.torch) {

      hint.textContent =
        "Turn on flashlight, cover camera + flash with fingertip, then start.";

    } else {

      hint.textContent =
        "Torch control unavailable. Turn phone flashlight on manually.";

    }

  } catch (error) {

    document.getElementById("hint").textContent =
      error.message;

  }
}


// ------------------------------------------------------
// FLASHLIGHT
// ------------------------------------------------------

async function toggleTorch() {

  if (!track) return;

  const capabilities =
    track.getCapabilities?.() || {};

  if (!capabilities.torch) {

    document.getElementById("hint").textContent =
      "Manual flashlight required on this device.";

    return;
  }

  try {

    torch = !torch;

    await track.applyConstraints({

      advanced: [
        {
          torch: torch
        }
      ]

    });

    document.getElementById("torchBtn").textContent =
      torch
        ? "🔦 Flashlight OFF"
        : "🔦 Flashlight ON";

  } catch (error) {

    document.getElementById("hint").textContent =
      "Flashlight control failed.";

  }
}


// ------------------------------------------------------
// START MEASUREMENT
// ------------------------------------------------------

function startMeasurement() {

  samples = [];
  signalBuffer = [];
  beats = [];
  lastBeatTime = 0;

  measuring = true;

  startedAt = performance.now();

  document.getElementById("startBtn").disabled =
    true;

  document.getElementById("stopBtn").disabled =
    false;

  document.getElementById("timer").style.display =
    "block";

  document.getElementById("status").textContent =
    "Measuring";

  document.getElementById("status").className =
    "status warn";

  captureTimer =
    setInterval(captureFrame, 50);

  countdownTimer =
    setInterval(updateCountdown, 250);

  updateCountdown();
}


// ------------------------------------------------------
// TIMER
// ------------------------------------------------------

function updateCountdown() {

  if (!measuring) return;

  const seconds = Math.floor(
    (performance.now() - startedAt) / 1000
  );

  const remaining =
    Math.max(0, MEASUREMENT_DURATION - seconds);

  document.getElementById("elapsed").textContent =
    seconds;

  document.getElementById("timer").textContent =
    remaining + " s";

  if (seconds >= MEASUREMENT_DURATION) {

    finishMeasurement(true);

  }
}


// ------------------------------------------------------
// CAPTURE CAMERA FRAME
// ------------------------------------------------------

function captureFrame() {

  if (!measuring) return;

  if (!video.videoWidth) return;

  hiddenCanvas.width = 160;
  hiddenCanvas.height = 120;

  ctx.drawImage(
    video,
    0,
    0,
    160,
    120
  );

  // Central region of interest.
  // The user should cover this area with the fingertip.

  const imageData =
    ctx.getImageData(
      45,
      25,
      70,
      70
    );

  const data = imageData.data;

  let red = 0;
  let green = 0;
  let blue = 0;

  const pixels =
    data.length / 4;

  for (
    let i = 0;
    i < data.length;
    i += 4
  ) {

    red += data[i];
    green += data[i + 1];
    blue += data[i + 2];

  }

  red /= pixels;
  green /= pixels;
  blue /= pixels;

  // Normalize red intensity.
  // Finger blood-volume changes affect the
  // camera intensity over time.

  const signal =
    red /
    Math.max(
      1,
      red + green + blue
    );

  const time =
    performance.now();

  samples.push({

    time: time,

    signal: signal,

    red: red,

    green: green,

    blue: blue

  });

  signalBuffer.push(signal);

  if (signalBuffer.length > 500) {

    signalBuffer.shift();

  }

  processSignal();

  drawChart();
}


// ------------------------------------------------------
// SIGNAL PROCESSING
// ------------------------------------------------------

function processSignal() {

  if (signalBuffer.length < 120) {

    return;

  }

  const x =
    signalBuffer.slice();

  const mean =
    x.reduce(
      (sum, value) => sum + value,
      0
    ) / x.length;

  const standardDeviation =
    Math.sqrt(
      x.reduce(
        (sum, value) =>
          sum + Math.pow(value - mean, 2),
        0
      ) / x.length
    );

  // Remove slow brightness changes.

  const detrended = [];

  const baselineWindow = 25;

  for (
    let i = 0;
    i < x.length;
    i++
  ) {

    const start =
      Math.max(
        0,
        i - baselineWindow
      );

    const end =
      Math.min(
        x.length,
        i + baselineWindow + 1
      );

    let sum = 0;

    for (
      let j = start;
      j < end;
      j++
    ) {

      sum += x[j];

    }

    const baseline =
      sum / (end - start);

    detrended.push(
      x[i] - baseline
    );

  }

  // Small smoothing filter.

  const smooth = [];

  for (
    let i = 2;
    i < detrended.length - 2;
    i++
  ) {

    smooth.push(

      (
        detrended[i - 2] +
        detrended[i - 1] +
        detrended[i] +
        detrended[i + 1] +
        detrended[i + 2]
      ) / 5

    );

  }

  const smoothMean =
    smooth.reduce(
      (a, b) => a + b,
      0
    ) / smooth.length;

  const smoothSD =
    Math.sqrt(
      smooth.reduce(
        (a, b) =>
          a + Math.pow(
            b - smoothMean,
            2
          ),
        0
      ) / smooth.length
    );

  const threshold =
    smoothMean + smoothSD * 0.45;

  // At least 400 ms between beats.
  // This prevents unrealistic BPM values.

  const refractoryPeriod = 400;

  const startIndex =
    Math.max(
      1,
      smooth.length - 25
    );

  for (
    let i = startIndex;
    i < smooth.length - 1;
    i++
  ) {

    const isPeak =
      smooth[i] > threshold &&
      smooth[i] >= smooth[i - 1] &&
      smooth[i] > smooth[i + 1];

    if (!isPeak) continue;

    const sampleIndex =
      samples.length -
      smooth.length +
      i;

    const time =
      samples[sampleIndex]?.time;

    if (!time) continue;

    if (
      time - lastBeatTime >
      refractoryPeriod
    ) {

      beats.push(time);

      lastBeatTime = time;

    }

  }

  // Keep recent beats.

  const cutoff =
    performance.now() - 35000;

  beats =
    beats.filter(
      time => time > cutoff
    );

  // Calculate beat-to-beat intervals.

  const intervals = [];

  for (
    let i = 1;
    i < beats.length;
    i++
  ) {

    const interval =
      beats[i] - beats[i - 1];

    if (
      interval >= 400 &&
      interval <= 1500
    ) {

      intervals.push(interval);

    }

  }

  // Signal quality estimate.

  const quality =
    Math.max(
      0,
      Math.min(
        100,
        Math.round(
          standardDeviation * 90000 +
          smoothSD * 220000
        )
      )
    );

  document.getElementById("quality").textContent =
    quality + "%";

  document.getElementById("qualityText").textContent =
    quality >= 65
      ? "Good"
      : quality >= 35
        ? "Fair"
        : "Weak";

  if (intervals.length >= 2) {

    const averageInterval =
      intervals.reduce(
        (a, b) => a + b,
        0
      ) / intervals.length;

    const bpm =
      60000 / averageInterval;

    const rmssd =
      calculateRMSSD(intervals);

    if (
      bpm >= 40 &&
      bpm <= 180
    ) {

      document.getElementById("bpm").textContent =
        Math.round(bpm);

    }

    if (rmssd !== null) {

      document.getElementById("rmssd").textContent =
        Math.round(rmssd);

    }

    if (typeof updateLiveReport === "function") {

      updateLiveReport(
        bpm,
        rmssd,
        quality
      );

    }

  }

}


// ------------------------------------------------------
// RMSSD
// ------------------------------------------------------

function calculateRMSSD(intervals) {

  if (intervals.length < 2) {

    return null;

  }

  let sum = 0;

  for (
    let i = 1;
    i < intervals.length;
    i++
  ) {

    sum += Math.pow(
      intervals[i] -
      intervals[i - 1],
      2
    );

  }

  return Math.sqrt(
    sum / (intervals.length - 1)
  );

}


// ------------------------------------------------------
// STRESS INDICATOR
// ------------------------------------------------------

function getStressLabel(rmssd) {

  if (rmssd === null) {

    return "Insufficient data";

  }

  if (rmssd < 25) {

    return "Higher experimental stress signal";

  }

  if (rmssd < 50) {

    return "Moderate experimental stress signal";

  }

  return "Lower experimental stress signal";

}


// ------------------------------------------------------
// LIVE REPORT
// ------------------------------------------------------

function updateLiveReport(
  bpm,
  rmssd,
  quality
) {

  const stress =
    getStressLabel(rmssd);

  document.getElementById("report").innerHTML =

    `Pulse: <b>${Math.round(bpm)} BPM</b><br>
     Experimental stress indicator:
     <b>${stress}</b><br>
     Signal quality:
     <b>${quality}%</b><br><br>
     <b>Blood pressure:</b>
     Not measured. This camera PPG prototype
     cannot reliably determine systolic/diastolic BP.`;

}


// ------------------------------------------------------
// WAVEFORM
// ------------------------------------------------------

function drawChart() {

  const width = chart.width;
  const height = chart.height;

  chartCtx.clearRect(
    0,
    0,
    width,
    height
  );

  chartCtx.fillStyle = "#08111f";

  chartCtx.fillRect(
    0,
    0,
    width,
    height
  );

  // Graph grid.

  chartCtx.strokeStyle =
    "#1b2a3e";

  chartCtx.lineWidth = 1;

  for (
    let x = 0;
    x <= width;
    x += 100
  ) {

    chartCtx.beginPath();

    chartCtx.moveTo(x, 0);
    chartCtx.lineTo(x, height);

    chartCtx.stroke();

  }

  for (
    let y = 0;
    y <= height;
    y += 76
  ) {

    chartCtx.beginPath();

    chartCtx.moveTo(0, y);
    chartCtx.lineTo(width, y);

    chartCtx.stroke();

  }

  const data =
    signalBuffer.slice(-500);

  if (data.length < 2) {

    chartCtx.fillStyle =
      "#65768b";

    chartCtx.font =
      "16px sans-serif";

    chartCtx.fillText(
      "PPG waveform will appear here",
      30,
      40
    );

    return;

  }

  const minimum =
    Math.min(...data);

  const maximum =
    Math.max(...data);

  const range =
    maximum - minimum || 1;

  chartCtx.beginPath();

  for (
    let i = 0;
    i < data.length;
    i++
  ) {

    const x =
      i /
      (data.length - 1) *
      width;

    const y =
      height -
      (
        (data[i] - minimum) /
        range
      ) *
      (height - 40) -
      20;

    if (i === 0) {

      chartCtx.moveTo(x, y);

    } else {

      chartCtx.lineTo(x, y);

    }

  }

  chartCtx.lineWidth = 3;

  chartCtx.strokeStyle =
    "#39d0b0";

  chartCtx.stroke();

}


// ------------------------------------------------------
// FINISH MEASUREMENT
// ------------------------------------------------------

function finishMeasurement(completed) {

  if (!measuring) return;

  measuring = false;

  clearInterval(captureTimer);
  clearInterval(countdownTimer);

  captureTimer = null;
  countdownTimer = null;

  document.getElementById("stopBtn").disabled =
    true;

  document.getElementById("startBtn").disabled =
    false;

  document.getElementById("timer").style.display =
    "none";

  document.getElementById("status").textContent =
    completed
      ? "Measurement complete"
      : "Measurement stopped";

  document.getElementById("status").className =
    "status good";

  processSignal();

  const bpm =
    parseFloat(
      document.getElementById("bpm").textContent
    );

  const rmssd =
    parseFloat(
      document.getElementById("rmssd").textContent
    );

  const quality =
    parseFloat(
      document.getElementById("quality").textContent
    );

  const result = {

    bpm: Number.isFinite(bpm)
      ? bpm
      : null,

    rmssd: Number.isFinite(rmssd)
      ? rmssd
      : null,

    quality: Number.isFinite(quality)
      ? quality
      : null,

    stress: getStressLabel(
      Number.isFinite(rmssd)
        ? rmssd
        : null
    ),

    duration: 60

  };

  window.finalMeasurement =
    result;

  if (completed &&
      typeof saveMeasurement === "function") {

    saveMeasurement(result);

  }

  document.getElementById("downloadReportBtn").disabled =
    false;

  if (typeof renderFinalReport === "function") {

    renderFinalReport();

  }

}
