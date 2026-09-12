import { createBrowserAdapter } from "../application-execution-adapter";

export const smartrecruitersAdapter = createBrowserAdapter({
  provider: "SMARTRECRUITERS",
  rootSelectors: [".smartr-widget, [data-ats='smartrecruiters'], #st-form, form:has(input[name='firstName']), form:has(input[name='email']), [class*='smartrecruiters']"],
  dataAts: "smartrecruiters",
  successMarker: "sr-application-success",
  errorMarker: "sr-application-error",
  confirmedBrowserSubmit: false,
  extraDetect: (url, markers) => {
    if (/smartrecruiters\.com/i.test(url)) return 0.93;
    return markers.some((row) => /smartrecruiters/.test(row)) ? 0.96 : 0;
  },
  version: "smartrecruiters-v2",
});
