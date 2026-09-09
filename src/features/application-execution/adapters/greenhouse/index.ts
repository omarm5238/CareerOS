import { createBrowserAdapter } from "../application-execution-adapter";

export const greenhouseAdapter = createBrowserAdapter({
  provider: "GREENHOUSE",
  rootSelectors: ["#greenhouse-application, [data-ats='greenhouse'], #application_form, form#application, #application, #main_fields, #application-form, form.application--form, .application--form"],
  dataAts: "greenhouse",
  successMarker: "gh-application-success",
  errorMarker: "gh-application-error",
  confirmedBrowserSubmit: false,
  extraDetect: (url, markers) => {
    if (/greenhouse\.io|grnh\.se|job-boards\.greenhouse/i.test(url)) return 0.93;
    return markers.some((row) => /greenhouse/.test(row)) ? 0.96 : 0;
  },
});
