import { createBrowserAdapter } from "../application-execution-adapter";

export const leverAdapter = createBrowserAdapter({
  provider: "LEVER",
  rootSelectors: [".lever-apply-form, [data-ats='lever'], .application-form, form#application-form, #application-form, form[action*='/apply']"],
  dataAts: "lever",
  successMarker: "lever-application-success",
  errorMarker: "lever-application-error",
  confirmedBrowserSubmit: false,
  extraDetect: (url, markers) => {
    if (/lever\.co/i.test(url)) return 0.93;
    return markers.some((row) => /lever/.test(row)) ? 0.96 : 0;
  },
});
