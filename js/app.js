// ======================================================
// app.js
// Main application controller.
// Connects the HTML UI with the other JavaScript modules.
// ======================================================

document
  .getElementById("patientForm")
  .addEventListener(
    "submit",
    handlePatientForm
  );

document
  .getElementById("cameraBtn")
  .addEventListener(
    "click",
    startCamera
  );

document
  .getElementById("torchBtn")
  .addEventListener(
    "click",
    toggleTorch
  );

document
  .getElementById("startBtn")
  .addEventListener(
    "click",
    startMeasurement
  );

document
  .getElementById("stopBtn")
  .addEventListener(
    "click",
    () => finishMeasurement(false)
  );

document
  .getElementById("downloadReportBtn")
  .addEventListener(
    "click",
    downloadReport
  );

document
  .getElementById("exportCsvBtn")
  .addEventListener(
    "click",
    exportCSV
  );

document
  .getElementById("clearHistoryBtn")
  .addEventListener(
    "click",
    clearHistory
  );

document
  .getElementById("newBtn")
  .addEventListener(
    "click",
    resetApplication
  );


// ------------------------------------------------------
// PATIENT FORM
// ------------------------------------------------------

function handlePatientForm(event) {

  event.preventDefault();

  const name =
    document.getElementById(
      "name"
    ).value.trim();

  const age =
    Number(
      document.getElementById(
        "age"
      ).value
    );

  const weight =
    Number(
      document.getElementById(
        "weight"
      ).value
    );

  const height =
    Number(
      document.getElementById(
        "height"
      ).value
    );

  if (
    !name ||
    !age ||
    !weight ||
    !height
  ) {

    alert(
      "Please enter all patient details."
    );

    return;

  }

  // BMI formula:
  // weight in kg / height in meters squared.

  const heightMeters =
    height / 100;

  const bmi =
    weight /
    Math.pow(
      heightMeters,
      2
    );

  window.patient = {

    name,
    age,
    weight,
    height,
    bmi

  };

  document.getElementById(
    "patientCard"
  ).style.display =
    "none";

  document.getElementById(
    "cameraCard"
  ).style.display =
    "block";

  const status =
    document.getElementById(
      "status"
    );

  status.textContent =
    "Ready for camera";

  status.className =
    "status good";

  document.getElementById(
    "report"
  ).innerHTML = `

    <b>
      ${escapeHTML(name)}
    </b>

    — patient details saved.

    <br>

    BMI:
    <b>
      ${bmi.toFixed(1)}
    </b>

    <br><br>

    Start the camera when ready.

  `;

}


// ------------------------------------------------------
// RESET APPLICATION
// ------------------------------------------------------

function resetApplication() {

  // Stop camera.

  if (stream) {

    stream
      .getTracks()
      .forEach(
        track => track.stop()
      );

  }

  stream = null;
  track = null;
  torch = false;

  // Stop timers.

  measuring = false;

  clearInterval(
    captureTimer
  );

  clearInterval(
    countdownTimer
  );

  // Clear patient/session data.

  window.patient = null;
  window.finalMeasurement = null;

  samples = [];
  signalBuffer = [];
  beats = [];

  // Reset form.

  document
    .getElementById(
      "patientForm"
    )
    .reset();

  // Show patient form again.

  document.getElementById(
    "patientCard"
  ).style.display =
    "block";

  document.getElementById(
    "cameraCard"
  ).style.display =
    "none";

  // Reset buttons.

  const cameraButton =
    document.getElementById(
      "cameraBtn"
    );

  cameraButton.disabled =
    false;

  cameraButton.textContent =
    "📷 Start Camera";

  document.getElementById(
    "torchBtn"
  ).disabled =
    true;

  document.getElementById(
    "startBtn"
  ).disabled =
    true;

  document.getElementById(
    "stopBtn"
  ).disabled =
    true;

  document.getElementById(
    "downloadReportBtn"
  ).disabled =
    true;

  // Reset metrics.

  document.getElementById(
    "bpm"
  ).textContent =
    "—";

  document.getElementById(
    "quality"
  ).textContent =
    "—";

  document.getElementById(
    "qualityText"
  ).textContent =
    "Waiting";

  document.getElementById(
    "rmssd"
  ).textContent =
    "—";

  document.getElementById(
    "elapsed"
  ).textContent =
    "0";

  document.getElementById(
    "timer"
  ).style.display =
    "none";

  document.getElementById(
    "status"
  ).textContent =
    "Patient details required";

  document.getElementById(
    "status"
  ).className =
    "status";

  document.getElementById(
    "report"
  ).textContent =
    "Enter patient details and complete a 60-second measurement to generate the report.";

  drawChart();

}


// ------------------------------------------------------
// INITIAL LOAD
// ------------------------------------------------------

renderHistory();

drawChart();
