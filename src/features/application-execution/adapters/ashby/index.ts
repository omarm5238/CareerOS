import { createBrowserAdapter } from "../application-execution-adapter";

export const ashbyAdapter = createBrowserAdapter({
  provider: "ASHBY",
  rootSelectors: ["[data-ashby-form], [data-ats='ashby'], #ashby_embed, form:has(input[name='email']), .ashby-job-posting-right-pane-application-tab, [class*='ashby']"],
  dataAts: "ashby",
  successMarker: "ashby-application-success",
  errorMarker: "ashby-application-error",
  confirmedBrowserSubmit: false,
  extraDetect: (url, markers) => {
    if (/ashbyhq\.com/i.test(url)) return 0.93;
    return markers.some((row) => /ashby/.test(row)) ? 0.96 : 0;
  },
});
