import { createBrowserAdapter } from "../application-execution-adapter";

export const workableAdapter = createBrowserAdapter({
  provider: "WORKABLE",
  rootSelectors: ["[data-ui='workable-application'], [data-ats='workable'], #application-form, form[id*='application'], form:has(input[name='firstname']), form:has(input[name='email'])"],
  dataAts: "workable",
  successMarker: "workable-application-success",
  errorMarker: "workable-application-error",
  confirmedBrowserSubmit: false,
  extraDetect: (url, markers) => {
    if (/workable\.com/i.test(url)) return 0.93;
    return markers.some((row) => /workable/.test(row)) ? 0.96 : 0;
  },
  version: "workable-v2",
});
