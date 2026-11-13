
// storage.js
// Local browser storage and CSV export.


function saveMeasurement(result) {

  if (!window.patient) return;

  const measurement = {

    date:
      new Date().toISOString(),

    displayDate:
      new Date().toLocaleString(),

    name:
      window.patient.name,

    age:
      window.patient.age,

    weight:
      window.patient.weight,

    height:
      window.patient.height,

    bmi:
      window.patient.bmi,

    bpm:
      result.bpm,

    rmssd:
      result.rmssd,

    quality:
      result.quality,

    stress:
      result.stress,

    duration:
      result.duration

  };

  const history =
    JSON.parse(
      localStorage.getItem(
        "pulselabHistory"
      ) || "[]"
    );

  history.unshift(measurement);

  // Keep maximum 50 records.

  localStorage.setItem(
    "pulselabHistory",
    JSON.stringify(
      history.slice(0, 50)
    )
  );

  renderHistory();

}



// SHOW HISTORY


function renderHistory() {

  const history =
    JSON.parse(
      localStorage.getItem(
        "pulselabHistory"
      ) || "[]"
    );

  const body =
    document.getElementById(
      "historyBody"
    );

  if (!history.length) {

    body.innerHTML = `

      <tr>

        <td
          class="empty"
          colspan="8"
        >
          No measurements saved yet.

        </td>

      </tr>

    `;

    return;

  }

  body.innerHTML =
    history.map(
      measurement => `

      <tr>

        <td>
          ${escapeHTML(
            measurement.displayDate
          )}
        </td>

        <td>
          ${escapeHTML(
            measurement.name
          )}
        </td>

        <td>
          ${measurement.age}
        </td>

        <td>
          ${measurement.weight} kg
        </td>

        <td>
          ${measurement.height} cm
        </td>

        <td>
          ${Number(
            measurement.bmi
          ).toFixed(1)}
        </td>

        <td>
          ${measurement.bpm ?? "—"}
        </td>

        <td>
          ${escapeHTML(
            measurement.stress
          )}
        </td>

      </tr>

    `
    ).join("");

}



// EXPORT CSV


function exportCSV() {

  const history =
    JSON.parse(
      localStorage.getItem(
        "pulselabHistory"
      ) || "[]"
    );

  if (!history.length) {

    alert(
      "No measurement data to export."
    );

    return;

  }

  const headers = [

    "Date",
    "Name",
    "Age",
    "Weight (kg)",
    "Height (cm)",
    "BMI",
    "BPM",
    "RMSSD (ms)",
    "Signal Quality (%)",
    "Stress",
    "Duration (sec)"

  ];

  const rows =
    history.map(
      measurement => [

        measurement.displayDate,

        measurement.name,

        measurement.age,

        measurement.weight,

        measurement.height,

        Number(
          measurement.bmi
        ).toFixed(1),

        measurement.bpm ?? "",

        measurement.rmssd ?? "",

        measurement.quality ?? "",

        measurement.stress,

        measurement.duration

      ]
    );

  const csv =
    [
      headers,
      ...rows
    ]

      .map(
        row =>
          row
            .map(csvCell)
            .join(",")
      )

      .join("\n");

  downloadBlob(
    "PulseLab_Measurements.csv",
    csv,
    "text/csv;charset=utf-8"
  );

}



// CLEAR HISTORY

function clearHistory() {

  if (
    confirm(
      "Clear all locally stored measurement history?"
    )
  ) {

    localStorage.removeItem(
      "pulselabHistory"
    );

    renderHistory();

  }

}


// CSV HELPER


function csvCell(value) {

  return `"${String(
    value ?? ""
  ).replace(
    /"/g,
    '""'
  )}"`;

}
