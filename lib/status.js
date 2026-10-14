export function flightStatusPresentation(status = "") {
  const rawStatus = String(status || "Scheduled").trim();
  const value = rawStatus.toLowerCase();

  if (value.includes("cancel")) {
    return { label: "Cancelled", className: "status status-muted" };
  }
  if (value.includes("divert")) {
    return { label: "Diverted", className: "status status-warning" };
  }
  if (value.includes("delay")) {
    return { label: "Delayed", className: "status status-warning" };
  }
  if (value.includes("arrived") || value.includes("landed")) {
    return { label: "Arrived", className: "status status-arrived" };
  }

  const live = value.includes("en route") || value.includes("on the way");
  if (value.includes("on time")) {
    return {
      label: "On Time",
      className: `status status-good${live ? " status-live" : ""}`,
    };
  }
  if (live) {
    return { label: "En Route", className: "status status-good status-live" };
  }
  if (value.includes("taxi")) {
    return { label: "Taxiing", className: "status status-info" };
  }
  if (value.includes("scheduled")) {
    return { label: "Scheduled", className: "status status-info" };
  }
  if (value.includes("unknown")) {
    return { label: "Unknown", className: "status" };
  }

  return { label: rawStatus, className: "status" };
}
